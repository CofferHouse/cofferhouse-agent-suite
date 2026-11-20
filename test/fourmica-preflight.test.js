import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFourmicaPreflight, classifyFourmicaReport, FOURMICA_SANDBOX } from '../packages/agent-modules/fourmica-preflight.js';
import { decodePaymentRequired } from '../packages/shared/fourmica-base64.js';
const now = Date.parse('2026-11-20T12:00:00.000Z');
function fixture() {
  return {
    challenge: { x402Version: 2, resource: { url: 'https://research.example.invalid/v1/report' }, accepts: [{ scheme: '4mica-credit', ...FOURMICA_SANDBOX, amount: '100000', payTo: '0x1111111111111111111111111111111111111111', maxTimeoutSeconds: 60 }] },
    selectedOffer: 0, requestId: `0x${'12'.repeat(32)}`, quoteCapturedAt: '2026-11-20T12:00:00.000Z',
    policy: { resourceUrl: 'https://research.example.invalid/v1/report', payTo: '0x1111111111111111111111111111111111111111', paused: false, expiresAt: '2026-11-20T13:00:00.000Z', perRequestUsdc: '0.1', taskRemainingUsdc: '1', periodRemainingUsdc: '5' },
  };
}
const check = input => evaluateFourmicaPreflight(input, { now });
test('sandbox preflight never authorizes, pays, reserves or claims replay protection', () => {
  const result = check(fixture());
  assert.equal(result.decision, 'REVIEW_REQUIRED'); assert.equal(result.amountAtomic, '100000');
  assert.deepEqual(result.execution, { enabled: false, signed: false, submitted: false });
  assert.equal(result.humanApprovalRequired, true); assert.equal(result.budgetReserved, false); assert.equal(result.replayProtectionEnforced, false);
  assert.deepEqual(check(fixture()), result);
});
test('v2 header and selected offer work without accepting malformed sibling offers', () => {
  const input = fixture(); input.challenge.accepts.push(null);
  input.challenge = btoa(JSON.stringify(input.challenge));
  assert.equal(check(input).decision, 'REVIEW_REQUIRED');
  input.selectedOffer = 1; assert.equal(check(input).decision, 'BLOCKED');
});
for (const [label, change, reason] of [
  ['Base mainnet', x => x.challenge.accepts[0].network = 'eip155:8453', 'BASE_MAINNET_SDK2_UPGRADE_PENDING'],
  ['Solana', x => x.challenge.accepts[0].network = 'solana:mainnet', 'UNSUPPORTED_NETWORK'],
  ['unlisted token', x => x.challenge.accepts[0].asset = x.policy.payTo, 'UNSUPPORTED_SANDBOX_ASSET'],
  ['different seller', x => x.challenge.accepts[0].payTo = `0x${'2'.repeat(40)}`, 'RECIPIENT_NOT_ALLOWLISTED'],
  ['route change', x => x.challenge.resource.url += '/other', 'RESOURCE_NOT_ALLOWLISTED'],
  ['query injection', x => { x.policy.resourceUrl += '?other=1'; x.challenge.resource.url = x.policy.resourceUrl; }, 'RESOURCE_NOT_ALLOWLISTED'],
  ['over budget', x => x.challenge.accepts[0].amount = '100001', 'SIMULATED_BUDGET_EXCEEDED'],
  ['boolean string', x => x.policy.paused = 'false', 'POLICY_PAUSED'],
  ['expired policy', x => x.policy.expiresAt = x.quoteCapturedAt, 'INVALID_POLICY_EXPIRY'],
  ['stale quote', x => x.quoteCapturedAt = '2026-11-20T11:58:59.000Z', 'STALE_QUOTE'],
  ['future quote', x => x.quoteCapturedAt = '2026-11-20T12:00:01.000Z', 'STALE_QUOTE'],
  ['validator requirement', x => x.challenge.accepts[0].extra = { validation: {} }, 'UNREVIEWED_EXTRA'],
  ['extensions', x => x.challenge.extensions = { hook: {} }, 'UNREVIEWED_EXTENSIONS'],
  ['zero request id', x => x.requestId = `0x${'0'.repeat(64)}`, 'INVALID_REQUEST_ID'],
]) test(`preflight blocks ${label}`, () => { const x = fixture(); change(x); const r = check(x); assert.equal(r.decision, 'BLOCKED'); assert.ok(r.reasons.includes(reason), JSON.stringify(r)); });
for (const amount of [0, 100000, '0', '-1', '01', '1e6', '1.5', String(2n ** 256n)]) test(`rejects noncanonical atomic amount ${amount}`, () => {
  const x = fixture(); x.challenge.accepts[0].amount = amount; assert.ok(check(x).reasons.includes('INVALID_ATOMIC_AMOUNT'));
});
test('malformed inputs fail closed', () => {
  for (const input of [null, {}, { challenge: '!!!' }, { ...fixture(), challenge: { ...fixture().challenge, x402Version: '2' } }]) assert.equal(check(input).decision, 'BLOCKED');
  const x = fixture(); x.policy.perRequestUsdc = 0.1; assert.equal(check(x).decision, 'BLOCKED');
});
test('bounded canonical base64 rejects invalid encoding, UTF-8 and JSON', () => {
  for (const input of ['', 'e30', 'e30=\n', 'e31=', '/w==', 'a'.repeat(32772), btoa('not json')]) assert.throws(() => decodePaymentRequired(input));
  assert.deepEqual(decodePaymentRequired('e30='), {});
});
test('HTTP 200 or success-like strings cannot establish payment success', () => {
  assert.equal(classifyFourmicaReport({ success: false }), 'REJECTED');
  for (const input of [null, {}, { status: 200 }, { success: 'true' }, { success: 'false' }]) assert.equal(classifyFourmicaReport(input), 'UNKNOWN');
  assert.equal(classifyFourmicaReport({ success: true, transaction: `0x${'1'.repeat(64)}` }), 'SUCCESS_REPORTED_UNVERIFIED');
});
