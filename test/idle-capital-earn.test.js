import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEarnVaultResponse } from '../packages/agent-modules/arc-app-kits.js';
import { earnLiquiditySource, earnLiquiditySources, earnSourceIssues, planIdleUsdcWithEarn } from '../packages/agent-modules/idle-capital-earn.js';
import { idleCapitalExample, idleCapitalInput, createIdleCapitalState, reconcileIdleCapitalSource, idleCapitalHtml } from '../packages/agent-modules/idle-capital-view.js';
import { createIdleCapitalReceipt } from '../packages/evidence/idle-capital-receipt.js';
import { verifyReceiptDocument } from '../packages/evidence/index.js';
const now = Date.parse('2026-11-23T12:00:00.000Z');
const at = new Date(now).toISOString(), addr = `0x${'1'.repeat(40)}`;
function data(changes = {}, response = {}) {
 return normalizeEarnVaultResponse({ observedAt: at, vaults: [{ vaultAddress: addr, name: 'Test USDC', protocol: 'TEST', asset: 'USDC', liquidity: '50000', currentApy: 0.05, totalDeposits: '100000', status: 'active', ...changes }], ...response });
}
function input() { return idleCapitalInput({ ...idleCapitalExample(now), scenarioAnnualSimpleRatePct: '3' }, { withdrawalTermsReviewed: true }); }
const source = d => earnLiquiditySource(d, addr, { now });

test('Earn normalization preserves exact SDK asset strings beyond floating-point precision', () => {
 const d = data({ liquidity: '9007199254740993.123456' });
 assert.equal(source(d).amountUsdc, '9007199254740993.123456');
 assert.equal(source(d).reportedApyPct, 5); assert.equal(source(d).liquidityAsOf, null);
 assert.equal(source(d).providerFreshnessVerified, false);
});
test('missing values are unknown and never invented as an observed zero or fresh source', () => {
 for (const liquidity of [null, undefined, '', false, 50000, '1e6', '-1', '0', '0.000000', '1.1234567']) assert.equal(source(data({ liquidity })), null, String(liquidity));
 const d = data({ currentApy: null });
 assert.equal(d.vaults[0].apyPct, null); assert.equal(source(d).reportedApyPct, null);
 assert.equal(d.vaults[0].totalDepositsUsd, 100000);
 const unreported = data({}, { observedAt: undefined });
 assert.equal(unreported.retrievedAt, null); assert.equal(source(unreported), null);
});
test('response freshness is required and provider timestamps are checked only when actually reported', () => {
 for (const timestamp of ['bad', new Date(now + 1).toISOString(), new Date(now - 300001).toISOString()]) {
   assert.equal(source(data({}, { observedAt: timestamp })), null);
   assert.equal(source(data({ asOf: timestamp })), null);
 }
 assert.equal(source(data({ asOf: at })).liquidityAsOf, at);
 assert.ok(source(data()));
});
test('source discovery rejects inactive, non-USDC, duplicate, zero and wrong-chain identities', () => {
 for (const changes of [{ asset: 'EURC' }, { status: 'low_liquidity' }, { status: 'paused' }, { vaultAddress: `0x${'0'.repeat(40)}` }]) assert.equal(earnLiquiditySources(data(changes), { now }).length, 0);
 const duplicate = data(); duplicate.vaults.push({ ...duplicate.vaults[0], vaultAddress: addr.toUpperCase().replace('0X','0x') });
 assert.equal(source(duplicate), null);
 assert.equal(source({ ...data(), chain: 'Base' }), null);
 assert.equal(source({ ...data(), mode: 'demo' }), null);
 assert.equal(source({ ...data(), schema: 'unknown' }), null);
});
test('Earn-linked plan imports liquidity only and never substitutes APY for the user simple-rate assumption', () => {
 const d = data(), s = source(d), values = { ...input(), vaultAvailableLiquidityUsdc: s.amountUsdc };
 const p = planIdleUsdcWithEarn(values, s, d, { now });
 assert.equal(p.decision, 'REVIEW_REQUIRED'); assert.equal(p.assumptions.scenarioAnnualSimpleRateBps, 300);
 assert.equal(p.marketSource.reportedApyPct, 5); assert.equal(p.marketSource.amountUsdc, '50000');
 assert.equal(p.reviewableAllocationUsdc, '4000.000000'); assert.equal(p.sourceReview.status, 'PROVIDER_REPORT_MATCHES');
 assert.equal(p.observationVerified, false); assert.equal(p.withdrawalGuaranteed, false); assert.equal(p.execution.submitted, false);
});
test('edited liquidity, changed amounts, changed timestamps and unavailable source block reviewable funds', () => {
 const d = data(), s = source(d), values = { ...input(), vaultAvailableLiquidityUsdc: s.amountUsdc };
 for (const [next, expected] of [[data({ liquidity: '49999' }), 'EARN_SOURCE_CHANGED'], [data({}, { observedAt: new Date(now - 1).toISOString() }), 'EARN_SOURCE_CHANGED'], [null, 'EARN_SOURCE_UNAVAILABLE']]) {
  const p = planIdleUsdcWithEarn(values, s, next, { now });
  assert.equal(p.decision, 'KEEP_LIQUID'); assert.equal(p.reviewableAllocationUsdc, '0.000000'); assert.ok(p.reasons.includes(expected));
 }
 const overridden = planIdleUsdcWithEarn({ ...values, vaultAvailableLiquidityUsdc: '999999' }, s, d, { now });
 assert.ok(overridden.reasons.includes('EARN_LIQUIDITY_OVERRIDE')); assert.equal(overridden.reviewableAllocationUsdc, '0.000000');
});
test('recording a new manual time cannot revive stale Earn evidence', () => {
 const d = data(), s = source(d), later = now + 300001;
 const values = { ...input(), observedAt: new Date(later).toISOString(), vaultAvailableLiquidityUsdc: s.amountUsdc };
 const p = planIdleUsdcWithEarn(values, s, d, { now: later });
 assert.ok(p.reasons.includes('EARN_SOURCE_STALE')); assert.equal(p.reviewableAllocationUsdc, '0.000000');
});
test('refresh reconciliation removes the previous result/download but retains source provenance for review', () => {
 const d = data(), state = createIdleCapitalState(); state.source = source(d); state.result = {}; state.receipt = {};
 reconcileIdleCapitalSource(state, data({ liquidity: '40000' }), now);
 assert.equal(state.result, null); assert.equal(state.receipt, null); assert.equal(state.sourceIssue, true);
 assert.equal(state.source.amountUsdc, '50000');
 assert.match(idleCapitalHtml(state, d), /Refresh and import the Earn source again/);
});
test('receipt seals source identity and keeps synthetic cash distinct from imported liquidity', () => {
 const d = data(), s = source(d), p = planIdleUsdcWithEarn({ ...input(), vaultAvailableLiquidityUsdc: s.amountUsdc }, s, d, { now });
 const r = createIdleCapitalReceipt(p, { generatedAt: at, example: true });
 assert.equal(r.inputSource, 'EARN_LIQUIDITY_WITH_EDITABLE_SYNTHETIC_CASH'); assert.equal(verifyReceiptDocument(r).valid, true);
 const altered = structuredClone(r); altered.scenario.marketSource.amountUsdc = '999999'; assert.equal(verifyReceiptDocument(altered).valid, false);
 assert.equal(createIdleCapitalReceipt(p).inputSource, 'EARN_LIQUIDITY_WITH_USER_ASSUMPTIONS');
});
test('forged source flags cannot claim verified provider freshness in a blocked plan', () => {
 const d = data(), s = { ...source(d), providerFreshnessVerified: true };
 const p = planIdleUsdcWithEarn({ ...input(), vaultAvailableLiquidityUsdc: s.amountUsdc }, s, d, { now });
 assert.equal(p.decision, 'KEEP_LIQUID'); assert.equal(p.marketSource.providerFreshnessVerified, false);
 assert.ok(earnSourceIssues(s, d, { now }).includes('EARN_SOURCE_CHANGED'));
});
