import { usdcUnits } from '../packages/agent-modules/treasury-plan.js';
import { getJson, compareAndSetJson } from './_redis.js';
import { validateTransferTracking, reconcileConfiguredTransfer } from './_transfer-reconciliation.js';
import { validateSwapIntent, validateSwapTracking, reconcileConfiguredSwap } from './_swap-reconciliation.js';

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
const format = value => `${value / 1_000_000n}.${String(value % 1_000_000n).padStart(6, '0')}`;
export class BudgetError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

// One immutable authorization window per bot ID; no TTL or implicit reset.
export function createBudgetLedger({ get = getJson, cas = compareAndSetJson, now = () => new Date(), reconcile = operation => operation.swapIntent ? reconcileConfiguredSwap(operation) : reconcileConfiguredTransfer(operation) } = {}) {
  return async function update({ botId, action, operationId, amountUsdc, policy, transaction, swapIntent }) {
    if (!validId(botId)) throw new BudgetError('Invalid bot identifier.', 400);
    if (!['initialize', 'reserve', 'release', 'pause', 'resume', 'track', 'reconcile'].includes(action)) throw new BudgetError('Unknown budget action.', 400);
    if (['reserve', 'release', 'track', 'reconcile'].includes(action) && !validId(operationId)) throw new BudgetError('An idempotency operation ID is required.', 400);
    const key = `cofferhouse:bot-budget:v1:${botId}`;
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await get(key);
      const timestamp = now();
      if (!Number.isFinite(timestamp.getTime())) throw new BudgetError('Invalid clock.', 503);
      let next;
      if (action === 'initialize') {
        if (current) throw new BudgetError('A budget already exists. It cannot be reset or overwritten.');
        const perAction = usdcUnits(policy?.perActionCapUsdc);
        const cap = usdcUnits(policy?.periodCapUsdc);
        const balance = usdcUnits(policy?.balanceUsdc);
        const reserve = usdcUnits(policy?.reserveUsdc);
        const expiry = typeof policy?.expiresAt === 'string' ? Date.parse(policy.expiresAt) : NaN;
        if (!perAction || perAction > cap || reserve > balance || cap > balance - reserve || !Number.isFinite(expiry) || expiry <= timestamp.getTime() || expiry > timestamp.getTime() + 86_400_000) throw new BudgetError('Invalid caps, reserve or authorization expiry (maximum 24 hours).', 400);
        next = { schema: 'cofferhouse.bot-budget.ledger.v1', botId, version: 1, createdAt: timestamp.toISOString(), expiresAt: new Date(expiry).toISOString(), paused: true,
          perActionUnits: String(perAction), periodCapUnits: String(cap), availableUnits: String(balance - reserve), reservedUnits: '0', spentUnits: '0', operations: {} };
      } else {
        if (!current || current.schema !== 'cofferhouse.bot-budget.ledger.v1') throw new BudgetError('Initialize a valid budget first.');
        next = structuredClone(current);
        next.version++;
        if (action === 'pause' || action === 'resume') {
          if (action === 'resume' && timestamp.getTime() >= Date.parse(current.expiresAt)) throw new BudgetError('Authorization expired.');
          next.paused = action === 'pause';
        } else {
          const existing = Object.hasOwn(current.operations, operationId) ? current.operations[operationId] : null;
          if (action === 'reserve') {
            const amount = usdcUnits(amountUsdc);
            let intent;
            if (swapIntent) { try { intent=validateSwapIntent(swapIntent,amount,existing ? new Date(existing.createdAt) : timestamp); } catch(error) { throw new BudgetError(error.message,400); } }
            // A retry returns the same reservation even if the policy later pauses/expires.
            // This acknowledges accounting only and never authorizes submission.
            if (existing) {
              if (existing.amountUnits !== String(amount) || existing.state !== 'RESERVED' || JSON.stringify(existing.swapIntent) !== JSON.stringify(intent)) throw new BudgetError('Operation ID is already bound to another amount or a released operation.');
              return summarize(current, operationId, true);
            }
            if (current.paused || timestamp.getTime() >= Date.parse(current.expiresAt)) throw new BudgetError('Budget is paused or expired.');
            if (Object.keys(current.operations).length >= 500) throw new BudgetError('Reservation history limit reached; review the ledger.');
            const reserved = BigInt(current.reservedUnits);
            if (amount === 0n || amount > BigInt(current.perActionUnits) || reserved + BigInt(current.spentUnits ?? '0') + amount > BigInt(current.periodCapUnits) || reserved + BigInt(current.spentUnits ?? '0') + amount > BigInt(current.availableUnits)) throw new BudgetError('Reservation exceeds the action, period or protected-balance limit.');
            next.reservedUnits = String(reserved + amount);
            next.operations[operationId] = { amountUnits: String(amount), state: 'RESERVED', createdAt: timestamp.toISOString(), ...(intent ? {swapIntent:intent} : {}) };
          } else if (action === 'track') {
            if (!existing) throw new BudgetError('Reservation not found.',404);
            let tracked;
            try { tracked=existing.swapIntent ? validateSwapTracking(transaction,existing.swapIntent) : validateTransferTracking(transaction); } catch(error) { throw new BudgetError(error.message,400); }
            if (existing.transaction) {
              if (JSON.stringify(existing.transaction)!==JSON.stringify(tracked)) throw new BudgetError('Operation is bound to another transaction.');
              return summarize(current,operationId,true);
            }
            if (existing.state!=='RESERVED') throw new BudgetError('Only an unsubmitted reservation can be tracked.');
            if (Object.values(current.operations).some(op=>op.transaction?.hash===tracked.hash)) throw new BudgetError('Transaction hash is already bound to another operation.');
            next.operations[operationId]={...existing,state:'PENDING',transaction:tracked,trackedAt:timestamp.toISOString()};
          } else if (action === 'reconcile') {
            if (!existing?.transaction) throw new BudgetError('Track a transaction before reconciling.');
            if (['CONFIRMED','FAILED'].includes(existing.state)) return summarize(current,operationId,true);
            const result=await reconcile(existing);
            if (!['PENDING','REVIEW','CONFIRMED','FAILED'].includes(result?.state)) throw new BudgetError('Invalid reconciliation result.',503);
            next.operations[operationId]={...existing,state:result.state,reconciliation:result,checkedAt:timestamp.toISOString()};
            if (['CONFIRMED','FAILED'].includes(result.state)) {
              next.reservedUnits=String(BigInt(current.reservedUnits)-BigInt(existing.amountUnits));
              if(result.state==='CONFIRMED') {
                const spent=result.spentUnits ?? existing.amountUnits;
                if(typeof spent!=='string' || !/^[1-9]\d{0,77}$/.test(spent) || BigInt(spent)>BigInt(existing.amountUnits)) throw new BudgetError('Invalid confirmed spending amount.',503);
                next.spentUnits=String(BigInt(current.spentUnits??'0')+BigInt(spent));
              }
            }
          } else {
            if (!existing) throw new BudgetError('Reservation not found.', 404);
            if (existing.state === 'RELEASED') return summarize(current, operationId, true);
            if (existing.state !== 'RESERVED') throw new BudgetError('Tracked or settled operations cannot be manually released.');
            next.reservedUnits = String(BigInt(current.reservedUnits) - BigInt(existing.amountUnits));
            next.operations[operationId] = { ...existing, state: 'RELEASED', releasedAt: timestamp.toISOString() };
          }
        }
      }
      if (await cas(key, current, next)) return summarize(next, operationId, false);
    }
    throw new BudgetError('Concurrent budget activity; retry with the same operation ID.', 503);
  };
}
function summarize(ledger, operationId, replayed) {
  return { botId: ledger.botId, version: ledger.version, paused: ledger.paused, expiresAt: ledger.expiresAt,
    reservedUsdc: format(BigInt(ledger.reservedUnits)), spentUsdc: format(BigInt(ledger.spentUnits ?? '0')), operation: operationId ? ledger.operations[operationId] : null, replayed,
    execution: { enabled: false, prepared: false, signed: false, submitted: false },
    notice: 'Reservation accounting only. Balances are operator-declared, not onchain-verified. Direct USDC transfers are supported; swaps require a server-enabled protocol adapter. Pending or uncertain transactions retain reservations. This service never broadcasts or signs transactions.' };
}
