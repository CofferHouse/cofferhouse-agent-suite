import test from 'node:test';
import assert from 'node:assert/strict';
import { planIdleUsdc, buildEarnStrategy } from '../packages/agent-modules/index.js';
import { createEarnStrategyReceipt, verifyReceiptDocument } from '../packages/evidence/index.js';
const now = Date.parse('2026-11-21T12:00:00.000Z');
function input(changes = {}) {
  return { walletUsdc: '10000', reserveUsdc: '2000', committedUsdc: '3000', earmarkedUsdc: '1000', maxAllocationUsdc: '8000', vaultAvailableLiquidityUsdc: '50000', maxLiquidityShareBps: 1000, entryCostUsdc: '0.5', exitCostUsdc: '0.5', minimumNetScenarioUsdc: '1', holdingHours: 240, withdrawalLeadHours: 24, scenarioAnnualSimpleRateBps: 500, observedAt: new Date(now).toISOString(), withdrawalTermsReviewed: true, paused: false, ...changes };
}
const plan = x => planIdleUsdc(x, { now });
test('idle plan protects disjoint reserves and obligations and subtracts exit time and costs', () => {
  const p = plan(input());
  assert.equal(p.decision, 'REVIEW_REQUIRED'); assert.equal(p.protectedUsdc, '6000.000000');
  assert.equal(p.availableUsdc, '4000.000000'); assert.equal(p.reviewableAllocationUsdc, '4000.000000');
  assert.equal(p.earningHours, 216); assert.equal(p.grossScenarioUsdc, '4.931506');
  assert.equal(p.netScenarioAfterEnteredCostsUsdc, '3.931506');
  assert.equal(p.observationVerified, false); assert.equal(p.withdrawalGuaranteed, false); assert.equal(p.realizedProfitUsdc, null);
  assert.deepEqual(p.execution, { prepared: false, signed: false, submitted: false });
});
test('allocation is capped by liquidity share and caller cap using integer micro-units', () => {
  assert.equal(plan(input({ vaultAvailableLiquidityUsdc: '10000.123456' })).modeledAllocationUsdc, '1000.012345');
  assert.equal(plan(input({ maxAllocationUsdc: '10.123456' })).modeledAllocationUsdc, '10.123456');
  assert.equal(plan(input({ walletUsdc: '6000.000001' })).modeledAllocationUsdc, '0.000001');
});
for (const [label, changes, reason] of [
  ['obligations exceed cash', { committedUsdc: '8000' }, 'COMMITMENTS_EXCEED_WALLET'],
  ['all cash protected', { walletUsdc: '6000' }, 'NO_DEPLOYABLE_CAPITAL'],
  ['missing withdrawal review', { withdrawalTermsReviewed: 'true' }, 'WITHDRAWAL_TERMS_UNREVIEWED'],
  ['zero withdrawal allowance', { withdrawalLeadHours: 0 }, 'INSUFFICIENT_WITHDRAWAL_WINDOW'],
  ['deadline before exit', { holdingHours: 12 }, 'INSUFFICIENT_WITHDRAWAL_WINDOW'],
  ['costs dominate yield', { entryCostUsdc: '10' }, 'SCENARIO_DOES_NOT_CLEAR_COSTS_AND_MARGIN'],
  ['zero-rate scenario', { scenarioAnnualSimpleRateBps: 0 }, 'SCENARIO_DOES_NOT_CLEAR_COSTS_AND_MARGIN'],
  ['paused policy', { paused: 'false' }, 'POLICY_PAUSED'],
  ['old observations', { observedAt: new Date(now - 300001).toISOString() }, 'STALE_OR_INVALID_OBSERVATION'],
  ['future observation', { observedAt: new Date(now + 1).toISOString() }, 'STALE_OR_INVALID_OBSERVATION'],
]) test(`idle plan keeps capital liquid: ${label}`, () => {
  const p = plan(input(changes)); assert.equal(p.decision, 'KEEP_LIQUID'); assert.equal(p.reviewableAllocationUsdc, '0.000000'); assert.ok(p.reasons.includes(reason));
});
test('incomplete or malformed assumptions fail closed instead of becoming free costs', () => {
  for (const x of [null, {}, input({ exitCostUsdc: undefined }), input({ reserveUsdc: 2000 }), input({ scenarioAnnualSimpleRateBps: '500' }), input({ holdingHours: 1.2 }), input({ maxLiquidityShareBps: 10001 }), input({ committedUsdc: '-1' })]) {
    const p = plan(x); assert.equal(p.decision, 'KEEP_LIQUID'); assert.equal(p.reviewableAllocationUsdc, '0.000000');
  }
});
function analysis(maxAmount = 10000) {
  return { schema: 'cofferhouse.arc-app-kits.earn-analysis.v1', chain: 'Arc', observedAt: new Date(now).toISOString(), source: 'synthetic-test', preferences: { minAvailableLiquidityUsd: 100, maxLiquiditySharePct: 10 }, opportunities: [{ eligible: true, researchScore: 80, maxResearchAmountUsd: maxAmount, vaultAddress: `0x${'1'.repeat(40)}`, name: 'Synthetic USDC', protocol: 'TEST_ONLY', asset: 'USDC', apyPct: 5, status: 'active', circleGuarded: false, warnings: [] }] };
}
const prefs = { capitalUsd: 10000, reservePct: 20, maxMarkets: 2, maxPerMarketPct: 100, minResearchScore: 0 };
test('Earn strategy opt-in applies cash constraints and includes them in the sealed receipt', () => {
  const proposal = buildEarnStrategy(analysis(), prefs, { idleCapitalInput: input(), now });
  assert.equal(proposal.summary.allocatedUsd, 4000); assert.equal(proposal.idleCapitalPlan.decision, 'REVIEW_REQUIRED');
  const receipt = createEarnStrategyReceipt(proposal);
  assert.equal(receipt.idleCapitalPlan.reviewableAllocationUsdc, '4000.000000'); assert.equal(verifyReceiptDocument(receipt).valid, true);
  const altered = structuredClone(receipt); altered.idleCapitalPlan.reviewableAllocationUsdc = '9999'; assert.equal(verifyReceiptDocument(altered).valid, false);
});
test('Earn strategy rechecks economics after real allocation caps reduce the modeled position', () => {
  const p = buildEarnStrategy(analysis(20), prefs, { idleCapitalInput: input(), now });
  assert.equal(p.summary.allocatedUsd, 0); assert.equal(p.positions.length, 0);
  assert.ok(p.idleCapitalPlan.reasons.includes('SCENARIO_DOES_NOT_CLEAR_COSTS_AND_MARGIN'));
});
test('Earn idle mode blocks non-USDC, stale assumptions and mismatched wallet balances', () => {
  const data = analysis(); data.opportunities[0].asset = 'EURC';
  assert.equal(buildEarnStrategy(data, prefs, { idleCapitalInput: input(), now }).summary.allocatedUsd, 0);
  assert.equal(buildEarnStrategy(analysis(), prefs, { idleCapitalInput: input({ observedAt: 'invalid' }), now }).positions.length, 0);
  assert.throws(() => buildEarnStrategy(analysis(), prefs, { idleCapitalInput: input({ walletUsdc: '10001' }), now }));
});
test('ordinary Earn allocations remain unchanged without opting into idle cash planning', () => {
  const p = buildEarnStrategy(analysis(), prefs);
  assert.equal(p.summary.allocatedUsd, 8000); assert.equal(p.idleCapitalPlan, null);
});
test('fresh cash assumptions cannot conceal stale Earn vault evidence', () => {
  const data = analysis(); data.observedAt = new Date(now - 300001).toISOString();
  const p = buildEarnStrategy(data, prefs, { idleCapitalInput: input(), now });
  assert.equal(p.positions.length, 0); assert.ok(p.idleCapitalPlan.reasons.includes('STALE_OR_INVALID_OBSERVATION'));
});
test('cost and rate assumptions remain in the output for review and replay', () => {
  const p = plan(input()); assert.equal(p.assumptions.scenarioAnnualSimpleRateBps, 500);
  assert.equal(p.assumptions.entryCostUsdc, '0.5'); assert.equal(p.assumptions.committedUsdc, '3000');
  assert.equal(p.assumptions.observedAt, new Date(now).toISOString());
});
