import { captureIdleCapitalScenario } from './idle-capital-comparison.js';

export const MAX_IDLE_SCENARIO_BYTES = 64000;
const rootKeys = new Set(['schema','generatedAt','sourceAgent','inputSource','scenario','notice','receiptId','integrity']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const iso = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
};
function inspect(value) {
  const queue = [[value,0]]; let count = 0;
  while (queue.length) {
    const [item,depth] = queue.pop();
    if (++count > 2000 || depth > 12) throw new Error('Scenario structure exceeds limits.');
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Nonfinite scenario value.');
    if (item && typeof item === 'object') {
      if (Array.isArray(item) && item.length > 64) throw new Error('Scenario array exceeds limits.');
      for (const [key,v] of Object.entries(item)) {
        if (['__proto__','prototype','constructor'].includes(key)) throw new Error('Unsupported scenario key.');
        queue.push([v,depth+1]);
      }
    }
  }
}
export function readIdleCapitalScenario(text, { now = Date.now() } = {}) {
  if (typeof text !== 'string' || !text.length || text.length > MAX_IDLE_SCENARIO_BYTES || new TextEncoder().encode(text).length > MAX_IDLE_SCENARIO_BYTES) throw new Error('Scenario file exceeds limits.');
  const document = JSON.parse(text.replace(/^\uFEFF/, ''));
  inspect(document);
  if (!isRecord(document) || Object.keys(document).some(key => !rootKeys.has(key)) || typeof document.sourceAgent !== 'string' || document.sourceAgent.length > 160 || typeof document.notice !== 'string' || document.notice.length > 2048 || typeof document.receiptId !== 'string' || !/^idle-capital-[0-9a-f]{16}$/.test(document.receiptId) || !iso(document.generatedAt) || !Number.isFinite(now) || Date.parse(document.generatedAt) > now + 60000) throw new Error('Unsupported scenario receipt.');
  const p = document.scenario;
  if (!isRecord(p) || p.observationVerified !== false || p.withdrawalGuaranteed !== false || p.realizedProfitUsdc !== null || p.humanApprovalRequired !== true) throw new Error('Unverified scenario boundaries are required.');
  const earn = p.mode === 'EARN_LIQUIDITY_WITH_CALLER_ASSUMPTIONS';
  if (typeof document.inputSource !== 'string' || document.inputSource.startsWith('EARN_') !== earn) throw new Error('Scenario provenance does not match its mode.');
  if (!earn && (p.marketSource != null || p.sourceReview != null)) throw new Error('Unexpected provider source in a manual scenario.');
  if (earn) {
    const s = p.marketSource, review = p.sourceReview;
    if (!isRecord(s) || s.schema !== 'cofferhouse.arc-earn.liquidity-source.v1' || s.source !== 'Circle Arc Earn Kit' || s.chain !== 'Arc' || s.asset !== 'USDC' || typeof s.vaultAddress !== 'string' || !/^0x[0-9a-f]{40}$/i.test(s.vaultAddress) || /^0x0{40}$/.test(s.vaultAddress) || typeof s.name !== 'string' || s.name.length > 256 || typeof s.protocol !== 'string' || s.protocol.length > 128 || typeof s.amountUsdc !== 'string' || !/^(0|[1-9][0-9]{0,17})(\.[0-9]{1,6})?$/.test(s.amountUsdc) || s.providerFreshnessVerified !== false || !iso(s.retrievedAt) || Date.parse(s.retrievedAt) > Date.parse(document.generatedAt) || (s.liquidityAsOf !== null && (!iso(s.liquidityAsOf) || Date.parse(s.liquidityAsOf) > Date.parse(document.generatedAt))) || (s.reportedApyPct !== null && (typeof s.reportedApyPct !== 'number' || !Number.isFinite(s.reportedApyPct) || s.reportedApyPct < 0))) throw new Error('Invalid captured Earn source.');
    const allowed = new Set(['EARN_SOURCE_UNAVAILABLE','EARN_SOURCE_STALE','EARN_SOURCE_CHANGED','EARN_LIQUIDITY_OVERRIDE']);
    if (!isRecord(review) || !['BLOCKED','PROVIDER_REPORT_MATCHES'].includes(review.status) || !iso(review.checkedAt) || Date.parse(review.checkedAt) > Date.parse(document.generatedAt) || !Array.isArray(review.reasons) || review.reasons.some(reason => !allowed.has(reason) || !p.reasons?.includes(reason)) || (review.status === 'BLOCKED' ? !review.reasons.length || p.decision !== 'KEEP_LIQUID' : review.reasons.length !== 0) || (p.decision === 'REVIEW_REQUIRED' && review.status !== 'PROVIDER_REPORT_MATCHES') || (s.amountUsdc !== p.assumptions?.vaultAvailableLiquidityUsdc && !review.reasons.includes('EARN_LIQUIDITY_OVERRIDE'))) throw new Error('Invalid captured source check.');
  }
  // Integrity and arithmetic checks use the original capture time, not today's time.
  return captureIdleCapitalScenario(document);
}
export async function readIdleCapitalScenarioFile(file, options) {
  if (!file || !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_IDLE_SCENARIO_BYTES || typeof file.arrayBuffer !== 'function') throw new Error('Select one bounded JSON scenario file.');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_IDLE_SCENARIO_BYTES) throw new Error('Scenario file exceeds limits.');
  return readIdleCapitalScenario(new TextDecoder('utf-8', { fatal:true }).decode(bytes), options);
}
