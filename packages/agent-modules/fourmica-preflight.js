import { decodePaymentRequired } from '../shared/fourmica-base64.js';
import { usdcUnits } from './treasury-plan.js';

// Pinned to the reviewed SDK 2.0 sandbox. This is not a live network registry.
export const FOURMICA_SANDBOX = Object.freeze({
  network: 'eip155:84532',
  asset: '0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f',
});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
const sameAddress = (a, b) => address(a) && address(b) && a.toLowerCase() === b.toLowerCase();
function exactHttps(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.href === value; } catch { return false; }
}
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && new Date(value).toISOString() === value ? Date.parse(value) : NaN;

/** Stateless sandbox check only. Caller-supplied policy and time are NOT authorization. */
export function evaluateFourmicaPreflight(input, { now = Date.now() } = {}) {
  const reasons = [];
  const block = reason => reasons.push(reason);
  let quote = null;
  let selected = null;
  let amount = null;
  try {
    if (!record(input)) throw new Error('input');
    quote = typeof input.challenge === 'string' ? decodePaymentRequired(input.challenge) : input.challenge;
    if (!record(quote) || JSON.stringify(quote).length > 24576 || quote.x402Version !== 2 || !Array.isArray(quote.accepts) || quote.accepts.length < 1 || quote.accepts.length > 8) throw new Error('challenge');
    if (!Number.isInteger(input.selectedOffer) || input.selectedOffer < 0 || input.selectedOffer >= quote.accepts.length) throw new Error('selection');
    selected = quote.accepts[input.selectedOffer];
    if (!record(selected)) throw new Error('offer');
    const policy = input.policy;
    if (!record(policy)) throw new Error('policy');
    if (selected.scheme !== '4mica-credit') block('UNSUPPORTED_SCHEME');
    if (selected.network !== FOURMICA_SANDBOX.network) block(selected.network === 'eip155:8453' ? 'BASE_MAINNET_SDK2_UPGRADE_PENDING' : 'UNSUPPORTED_NETWORK');
    if (!sameAddress(selected.asset, FOURMICA_SANDBOX.asset)) block('UNSUPPORTED_SANDBOX_ASSET');
    if (!sameAddress(selected.payTo, policy.payTo)) block('RECIPIENT_NOT_ALLOWLISTED');
    if (!record(quote.resource) || !exactHttps(quote.resource.url) || !exactHttps(policy.resourceUrl) || quote.resource.url !== policy.resourceUrl) block('RESOURCE_NOT_ALLOWLISTED');
    if (typeof selected.amount !== 'string' || !/^[1-9][0-9]{0,77}$/.test(selected.amount) || BigInt(selected.amount) >= 2n ** 256n) block('INVALID_ATOMIC_AMOUNT');
    else amount = BigInt(selected.amount);
    if (!Number.isInteger(selected.maxTimeoutSeconds) || selected.maxTimeoutSeconds < 1 || selected.maxTimeoutSeconds > 300) block('UNREVIEWED_TIMEOUT');
    // Unknown protocol requirements must never be silently bypassed.
    if (selected.extra !== undefined && (!record(selected.extra) || Object.keys(selected.extra).length)) block('UNREVIEWED_EXTRA');
    if (quote.extensions !== undefined && (!record(quote.extensions) || Object.keys(quote.extensions).length)) block('UNREVIEWED_EXTENSIONS');
    if (policy.paused !== false) block('POLICY_PAUSED');
    const expiry = timestamp(policy.expiresAt), captured = timestamp(input.quoteCapturedAt);
    if (!Number.isFinite(now) || !Number.isFinite(expiry) || expiry <= now || expiry - now > 86400000) block('INVALID_POLICY_EXPIRY');
    if (!Number.isFinite(captured) || captured > now || now - captured > 60000) block('STALE_QUOTE');
    if (typeof input.requestId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(input.requestId) || /^0x0{64}$/.test(input.requestId)) block('INVALID_REQUEST_ID');
    const caps = [policy.perRequestUsdc, policy.taskRemainingUsdc, policy.periodRemainingUsdc].map(usdcUnits);
    if (caps.some(cap => cap === 0n)) block('ZERO_BUDGET');
    if (amount !== null && caps.some(cap => amount > cap)) block('SIMULATED_BUDGET_EXCEEDED');
  } catch { block('MALFORMED_INPUT'); }
  return {
    schema: 'cofferhouse.4mica.preflight.v1',
    mode: 'SIMULATION_ONLY',
    decision: reasons.length ? 'BLOCKED' : 'REVIEW_REQUIRED',
    reasons: [...new Set(reasons)],
    selectedOffer: Number.isInteger(input?.selectedOffer) ? input.selectedOffer : null,
    amountAtomic: amount === null ? null : String(amount),
    humanApprovalRequired: true,
    execution: { enabled: false, signed: false, submitted: false },
    budgetReserved: false,
    replayProtectionEnforced: false,
    notice: 'Untrusted quote and caller-supplied budget simulation only. No authorization, provider verification, guarantee verification, settlement, purchase, yield or profit is established. A future executor must authenticate policy, atomically reserve obligations, enforce durable idempotency and verify delivery and settlement separately.',
  };
}

/** A facilitator response is a report, never independently verified payment proof. */
export function classifyFourmicaReport(report) {
  if (!record(report) || report.success !== true) return report?.success === false ? 'REJECTED' : 'UNKNOWN';
  return 'SUCCESS_REPORTED_UNVERIFIED';
}
