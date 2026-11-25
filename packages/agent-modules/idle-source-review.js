import { captureIdleCapitalScenario } from './idle-capital-comparison.js';
import { usdcUnits } from './treasury-plan.js';

const fresh = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now && now - Date.parse(value) <= 300000;
const amount = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,17})(\.[0-9]{1,6})?$/.test(value);
const format = n => `${n < 0n ? '-' : ''}${(n < 0n ? -n : n) / 1000000n}.${String((n < 0n ? -n : n) % 1000000n).padStart(6, '0')}`;

export function reviewIdleCapitalSource(receipt, data, { now = Date.now() } = {}) {
  const snapshot = captureIdleCapitalScenario(receipt), old = snapshot.scenario.marketSource;
  if (!Number.isFinite(new Date(now).getTime())) throw new Error('A valid review time is required.');
  const result = {
    schema: 'cofferhouse.treasury.idle-source-review.v1', checkedAt: new Date(now).toISOString(),
    receiptId: snapshot.receiptId, capturedAt: snapshot.generatedAt,
    status: old ? 'UNAVAILABLE' : 'NO_EARN_SOURCE', issues: [],
    previous: old ?? null, current: null, deltaLiquidityUsdc: null,
    capturedReviewableUsdc: snapshot.scenario.reviewableAllocationUsdc,
    underlyingFreshnessVerified: false, withdrawalGuaranteed: false,
    notice: 'Dated provider-report review only. Missing from a returned page is not proof a vault closed. Cached responses may repeat. No saved calculation, source timestamp or allocation is updated or authorized.',
  };
  if (!old) return result;
  if (old.schema !== 'cofferhouse.arc-earn.liquidity-source.v1' || old.chain !== 'Arc' || old.asset !== 'USDC' || typeof old.vaultAddress !== 'string' || !/^0x[0-9a-f]{40}$/i.test(old.vaultAddress) || /^0x0{40}$/.test(old.vaultAddress) || !amount(old.amountUsdc) || !Number.isFinite(Date.parse(old.retrievedAt))) { result.issues.push('INVALID_CAPTURED_SOURCE'); return result; }
  if (data?.schema !== 'cofferhouse.arc-app-kits.earn.v1' || data.chain !== 'Arc' || data.source !== 'Circle Arc Earn Kit' || data.mode !== 'official-read-only' || !Array.isArray(data.vaults) || data.vaults.length > 1000) { result.issues.push('SOURCE_UNAVAILABLE'); return result; }
  if (!fresh(data.retrievedAt, now)) { result.issues.push('SOURCE_STALE'); return result; }
  if (Date.parse(data.retrievedAt) < Date.parse(old.retrievedAt)) { result.issues.push('OLDER_RESPONSE'); return result; }
  const matches = data.vaults.filter(v => typeof v?.vaultAddress === 'string' && v.vaultAddress.toLowerCase() === old.vaultAddress.toLowerCase());
  if (matches.length !== 1) { result.issues.push(matches.length ? 'DUPLICATE_IDENTITY' : 'VAULT_NOT_RETURNED'); return result; }
  const v = matches[0];
  if (v.asset !== 'USDC') { result.issues.push('ASSET_CHANGED'); return result; }
  if (v.liquidityAsOf !== null && !fresh(v.liquidityAsOf, now)) { result.issues.push('SOURCE_STALE'); return result; }
  if (Number.isFinite(Date.parse(old.liquidityAsOf)) && Number.isFinite(Date.parse(v.liquidityAsOf)) && Date.parse(v.liquidityAsOf) < Date.parse(old.liquidityAsOf)) { result.issues.push('OLDER_RESPONSE'); return result; }
  const currentAmount = amount(v.availableLiquidityAssetAmount) ? v.availableLiquidityAssetAmount : null;
  const apy = typeof v.apyPct === 'number' && Number.isFinite(v.apyPct) && v.apyPct >= 0 ? v.apyPct : null;
  result.current = { vaultAddress: old.vaultAddress, name: String(v.name ?? '').slice(0,256), protocol: String(v.protocol ?? '').slice(0,128), asset: 'USDC', status: String(v.status ?? 'unknown').slice(0,64), amountUsdc: currentAmount, reportedApyPct: apy, retrievedAt: data.retrievedAt, liquidityAsOf: v.liquidityAsOf, providerFreshnessVerified: false };
  if (v.status !== 'active') result.issues.push('VAULT_NOT_ACTIVE');
  if (result.current.protocol !== old.protocol) result.issues.push('PROTOCOL_CHANGED');
  if (apy === null) result.issues.push('APY_UNKNOWN');
  else if (old.reportedApyPct === null || apy !== old.reportedApyPct) result.issues.push('APY_CHANGED');
  if (currentAmount === null) result.issues.push('LIQUIDITY_UNKNOWN');
  else {
    const units = usdcUnits(currentAmount), delta = units - usdcUnits(old.amountUsdc);
    result.deltaLiquidityUsdc = format(delta);
    if (delta !== 0n) result.issues.push('LIQUIDITY_CHANGED');
    if (units === 0n) result.issues.push('ZERO_LIQUIDITY');
    const share = snapshot.scenario.assumptions.maxLiquidityShareBps;
    if (Number.isInteger(share) && share >= 1 && share <= 10000 && usdcUnits(result.capturedReviewableUsdc) > units * BigInt(share) / 10000n) result.issues.push('CAPTURED_SIZE_EXCEEDS_SHARE');
  }
  result.status = currentAmount === null || apy === null ? 'INCOMPLETE' : result.issues.length ? 'CHANGED' : 'UNCHANGED';
  return result;
}
