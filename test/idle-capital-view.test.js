import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdleCapitalState, idleCapitalExample, idleCapitalInput, idleCapitalHtml, idleCapitalResultHtml, idleCapitalFields } from '../packages/agent-modules/idle-capital-view.js';
import { planIdleUsdc } from '../packages/agent-modules/idle-capital.js';
import { createIdleCapitalReceipt } from '../packages/evidence/idle-capital-receipt.js';
import { verifyReceiptDocument } from '../packages/evidence/index.js';
import { translateHolderText } from '../packages/ui/holder-i18n.js';
const now = Date.parse('2026-11-22T12:00:00.000Z');

test('USDC form begins blank and cannot imply live balances or ready approval', () => {
  const state = createIdleCapitalState();
  assert.ok(Object.values(state.values).every(value => value === ''));
  assert.equal(state.withdrawalTermsReviewed, false); assert.equal(state.result, null);
  const html = idleCapitalHtml(state);
  assert.match(html, /balances, exit liquidity and withdrawal timing are not verified/);
  assert.ok(!html.includes('idle-capital-download')); assert.ok(!/<input\b[^>]*\schecked(?:\s|=|>)/.test(html));
  assert.match(html, /name="walletUsdc"/); assert.match(html, /name="observedAt"/);
});
test('percent conversion preserves basis points without floating point or empty-number coercion', () => {
  const example = idleCapitalExample(now);
  const input = idleCapitalInput({ ...example, scenarioAnnualSimpleRatePct: '3.29', maxLiquiditySharePct: '0.01' }, { withdrawalTermsReviewed: true });
  assert.equal(input.scenarioAnnualSimpleRateBps, 329); assert.equal(input.maxLiquidityShareBps, 1);
  assert.equal(input.walletUsdc, '10000'); assert.equal(input.withdrawalTermsReviewed, true);
  for (const invalid of ['', '1e2', '1.001', '-1', '100.01', 'Infinity']) {
    assert.throws(() => idleCapitalInput({ ...example, scenarioAnnualSimpleRatePct: invalid }));
  }
  assert.throws(() => idleCapitalInput({ ...example, holdingHours: '' }));
  assert.throws(() => idleCapitalInput({ ...example, holdingHours: '1.5' }));
  assert.throws(() => idleCapitalInput({ ...example, holdingHours: '8761' }));
});
test('synthetic example is explicitly reviewed and exports a supported tamper-evident receipt', () => {
  const values = idleCapitalExample(now);
  const blocked = planIdleUsdc(idleCapitalInput(values), { now });
  assert.equal(blocked.decision, 'KEEP_LIQUID'); assert.ok(blocked.reasons.includes('WITHDRAWAL_TERMS_UNREVIEWED'));
  const result = planIdleUsdc(idleCapitalInput(values, { withdrawalTermsReviewed: true }), { now });
  assert.equal(result.netScenarioAfterEnteredCostsUsdc, '3.931506');
  const receipt = createIdleCapitalReceipt(result, { generatedAt: new Date(now).toISOString(), example: true });
  assert.equal(receipt.inputSource, 'EDITABLE_SYNTHETIC_EXAMPLE');
  assert.equal(verifyReceiptDocument(receipt).valid, true);
  assert.equal(receipt.scenario.assumptions.scenarioAnnualSimpleRateBps, 500);
  const altered = structuredClone(receipt); altered.scenario.assumptions.committedUsdc = '0';
  assert.equal(verifyReceiptDocument(altered).valid, false);
  assert.match(idleCapitalResultHtml({ result, receipt, example: true }), /Synthetic example figures/);
});
test('view escapes field values and displays each blocking reason in ordinary language', () => {
  const state = createIdleCapitalState(); state.values.walletUsdc = '"><img src=x onerror=alert(1)>';
  const html = idleCapitalHtml(state);
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img'));
  const result = planIdleUsdc(idleCapitalInput(idleCapitalExample(now), { withdrawalTermsReviewed: false, paused: true }), { now });
  const output = idleCapitalResultHtml({ result, example: false });
  assert.match(output, /Review the withdrawal terms before comparing scenarios/);
  assert.match(output, /Scenario review is paused/); assert.match(output, /0.000000 USDC/);
  assert.ok(!output.includes('WITHDRAWAL_TERMS_UNREVIEWED'));
});
test('form labels and decision text translate in every supported non-English language', () => {
  const labels = ['USDC planning between commitments', 'LOAD SYNTHETIC EXAMPLE', 'EVALUATE USDC SCENARIO', 'DOWNLOAD USDC SCENARIO', 'Keep funds liquid', 'Scenario clears entered limits; review required', ...idleCapitalFields.flatMap(group => [group.title, ...group.fields.map(field => field[1])])];
  for (const lang of ['zh','ja','hi','es']) for (const label of labels) assert.notEqual(translateHolderText(label, lang), label, lang + ': ' + label);
  assert.throws(() => createIdleCapitalReceipt({ schema: 'unrelated' }));
});

