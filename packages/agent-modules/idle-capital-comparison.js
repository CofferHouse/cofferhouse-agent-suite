import { verifySealedDocument } from '../evidence/integrity.js';
import { usdcUnits } from './treasury-plan.js';
import { planIdleUsdc } from './idle-capital.js';

const monetary = ['protectedUsdc', 'availableUsdc', 'modeledAllocationUsdc', 'grossScenarioUsdc', 'netScenarioAfterEnteredCostsUsdc'];
const signedUnits = value => {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^-?\d{1,24}(\.\d{1,6})?$/.test(value)) throw new Error('Invalid scenario amount.');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const units = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  return value.startsWith('-') ? -units : units;
};
const format = value => value === null ? null : `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 1000000n}.${String((value < 0n ? -value : value) % 1000000n).padStart(6, '0')}`;
function validate(receipt) {
  if (!receipt || JSON.stringify(receipt).length > 64000 || receipt.schema !== 'cofferhouse.treasury.idle-capital-receipt.v1' || !verifySealedDocument(receipt).valid) throw new Error('A supported, unchanged USDC scenario receipt is required.');
  const p = receipt.scenario;
  const origins = ['EDITABLE_SYNTHETIC_EXAMPLE', 'USER_ENTERED_SCENARIO', 'EARN_LIQUIDITY_WITH_EDITABLE_SYNTHETIC_CASH', 'EARN_LIQUIDITY_WITH_USER_ASSUMPTIONS'];
  if (!origins.includes(receipt.inputSource)) throw new Error('Scenario input provenance is required.');
  if (p?.schema !== 'cofferhouse.treasury.idle-capital-plan.v1' || !['CALLER_ENTERED_SCENARIO', 'EARN_LIQUIDITY_WITH_CALLER_ASSUMPTIONS'].includes(p.mode) || !['KEEP_LIQUID', 'REVIEW_REQUIRED'].includes(p.decision) || !Array.isArray(p.reasons) || !p.assumptions || !Number.isFinite(Date.parse(receipt.generatedAt)) || !['prepared', 'signed', 'submitted'].every(key => p.execution?.[key] === false)) throw new Error('Unsupported or executable scenario.');
  const arithmetic = planIdleUsdc(p.assumptions, { now: Date.parse(receipt.generatedAt) });
  for (const key of [...monetary, 'earningHours']) if (p[key] !== arithmetic[key]) throw new Error('Scenario arithmetic does not match its assumptions.');
  if (typeof p.reviewableAllocationUsdc !== 'string' || arithmetic.reasons.some(reason => !p.reasons.includes(reason))) throw new Error('Scenario checks do not match assumptions.');
  if (p.decision === 'KEEP_LIQUID' ? p.reviewableAllocationUsdc !== '0.000000' || p.reasons.length === 0 : p.reasons.length !== 0 || arithmetic.decision !== 'REVIEW_REQUIRED' || p.reviewableAllocationUsdc !== arithmetic.modeledAllocationUsdc) throw new Error('Invalid reviewable amount.');
  for (const key of [...monetary, 'reviewableAllocationUsdc']) signedUnits(p[key]);
  return p;
}
export function captureIdleCapitalScenario(receipt) {
  validate(receipt);
  return structuredClone(receipt);
}
function inputAmount(p, key) { try { return format(usdcUnits(p.assumptions[key])); } catch { return null; } }
function totalCosts(p) { try { return format(usdcUnits(p.assumptions.entryCostUsdc) + usdcUnits(p.assumptions.exitCostUsdc)); } catch { return null; } }
export function compareIdleCapitalReceipts(a, b) {
  const left = validate(a), right = validate(b);
  const issues = [];
  const walletA = inputAmount(left, 'walletUsdc'), walletB = inputAmount(right, 'walletUsdc');
  if (walletA === null || walletB === null || monetary.some(key => left[key] === null || right[key] === null)) issues.push('INCOMPLETE_SCENARIO');
  if (walletA !== walletB) issues.push('DIFFERENT_WALLET_BALANCE');
  if (left.assumptions.holdingHours !== right.assumptions.holdingHours) issues.push('DIFFERENT_HOLDING_WINDOW');
  if (a.receiptId === b.receiptId) issues.push('SAME_SNAPSHOT');
  const comparable = issues.length === 0;
  const rows = [
    ['wallet', walletA, walletB], ['protected', left.protectedUsdc, right.protectedUsdc],
    ['available', left.availableUsdc, right.availableUsdc], ['modeled', left.modeledAllocationUsdc, right.modeledAllocationUsdc],
    ['reviewable', left.reviewableAllocationUsdc, right.reviewableAllocationUsdc],
    ['liquidity', inputAmount(left, 'vaultAvailableLiquidityUsdc'), inputAmount(right, 'vaultAvailableLiquidityUsdc')],
    ['cap', inputAmount(left, 'maxAllocationUsdc'), inputAmount(right, 'maxAllocationUsdc')], ['costs', totalCosts(left), totalCosts(right)],
    ['gross', left.grossScenarioUsdc, right.grossScenarioUsdc], ['net', left.netScenarioAfterEnteredCostsUsdc, right.netScenarioAfterEnteredCostsUsdc],
  ].map(([id, valueA, valueB]) => ({ id, aUsdc: valueA, bUsdc: valueB,
    deltaBMinusAUsdc: comparable && valueA !== null && valueB !== null ? format(signedUnits(valueB) - signedUnits(valueA)) : null }));
  return {
    schema: 'cofferhouse.treasury.idle-comparison.v1', status: comparable ? 'ARITHMETIC_COMPARISON_ONLY' : 'NOT_COMPARABLE', issues, rows,
    capturedReceiptIds: { a: a.receiptId, b: b.receiptId }, capturedAt: { a: a.generatedAt, b: b.generatedAt },
    decisionsAtCapture: { a: left.decision, b: right.decision },
    holdingHours: { a: left.assumptions.holdingHours, b: right.assumptions.holdingHours }, earningHours: { a: left.earningHours, b: right.earningHours },
    inputsDiffer: a.inputSource !== b.inputSource || left.marketSource?.vaultAddress !== right.marketSource?.vaultAddress || left.marketSource?.retrievedAt !== right.marketSource?.retrievedAt, execution: { prepared: false, signed: false, submitted: false },
    notice: 'Historical scenario snapshots only. A difference is B minus A, not a profit ranking or permission to invest. Captured decisions do not establish current eligibility. Different rates, reserves, withdrawal assumptions and provider snapshots can explain differences. Nothing refreshes or authenticates balances, market data or returns.',
  };
}
