import { usdcUnits } from '../packages/agent-modules/treasury-plan.js';
import { getJson, compareAndSetJson } from './_redis.js';

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
const format = value => `${value / 1_000_000n}.${String(value % 1_000_000n).padStart(6, '0')}`;
export class BudgetError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

// One immutable authorization window per bot ID; no TTL or implicit reset.
export function createBudgetLedger({ get = getJson, cas = compareAndSetJson, now = () => new Date() } = {}) {
  return async function update({ botId, action, operationId, amountUsdc, policy }) {
    if (!validId(botId)) throw new BudgetError('Invalid bot identifier.', 400);
    if (!['initialize', 'reserve', 'release', 'pause', 'resume'].includes(action)) throw new BudgetError('Unknown budget action.', 400);
    if (['reserve', 'release'].includes(action) && !validId(operationId)) throw new BudgetError('An idempotency operation ID is required.', 400);
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
          perActionUnits: String(perAction), periodCapUnits: String(cap), availableUnits: String(balance - reserve), reservedUnits: '0', operations: {} };
      } else {
        if (!current || current.schema !== 'cofferhouse.bot-budget.ledger.v1') throw new BudgetError('Initialize a valid budget first.');
        next = structuredClone(current);
        next.version++;
        if (action === 'pause' || action === 'resume') {
          if (action === 'resume' && timestamp.getTime() >= Date.parse(current.expiresAt)) throw new BudgetError('Authorization expired.');
          next.paused = action === 'pause';
        } else {
          const existing = current.operations[operationId];
          if (action === 'reserve') {
            const amount = usdcUnits(amountUsdc);
            // A retry returns the same reservation even if the policy later pauses/expires.
            // This acknowledges accounting only and never authorizes submission.
            if (existing) {
              if (existing.amountUnits !== String(amount) || existing.state !== 'RESERVED') throw new BudgetError('Operation ID is already bound to another amount or a released operation.');
              return summarize(current, operationId, true);
            }
            if (current.paused || timestamp.getTime() >= Date.parse(current.expiresAt)) throw new BudgetError('Budget is paused or expired.');
            if (Object.keys(current.operations).length >= 500) throw new BudgetError('Reservation history limit reached; review the ledger.');
            const reserved = BigInt(current.reservedUnits);
            if (amount === 0n || amount > BigInt(current.perActionUnits) || reserved + amount > BigInt(current.periodCapUnits) || reserved + amount > BigInt(current.availableUnits)) throw new BudgetError('Reservation exceeds the action, period or protected-balance limit.');
            next.reservedUnits = String(reserved + amount);
            next.operations[operationId] = { amountUnits: String(amount), state: 'RESERVED', createdAt: timestamp.toISOString() };
          } else {
            if (!existing) throw new BudgetError('Reservation not found.', 404);
            if (existing.state === 'RELEASED') return summarize(current, operationId, true);
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
    reservedUsdc: format(BigInt(ledger.reservedUnits)), operation: operationId ? ledger.operations[operationId] : null, replayed,
    execution: { enabled: false, prepared: false, signed: false, submitted: false },
    notice: 'Reservation accounting only. Balances are operator-declared, not onchain-verified. Release is for unsubmitted plans only; no executor or settlement transition is enabled.' };
}
