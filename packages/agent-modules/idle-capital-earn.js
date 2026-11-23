import { usdcUnits } from './treasury-plan.js';
import { planIdleUsdc } from './idle-capital.js';

const fields = ['schema', 'source', 'chain', 'vaultAddress', 'name', 'protocol', 'asset', 'amountUsdc', 'retrievedAt', 'liquidityAsOf', 'reportedApyPct', 'providerFreshnessVerified'];
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
const fresh = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Number.isFinite(now) && Date.parse(value) <= now && now - Date.parse(value) <= 300000;
const amount = value => { try { return typeof value === 'string' && /^(0|[1-9][0-9]{0,17})(\.[0-9]{1,6})?$/.test(value) && usdcUnits(value) > 0n; } catch { return false; } };

/** Uses only explicitly timestamped SDK responses. A fetch timestamp is not a provider freshness proof. */
export function earnLiquiditySource(data, vaultAddress, { now = Date.now() } = {}) {
  if (data?.schema !== 'cofferhouse.arc-app-kits.earn.v1' || data.chain !== 'Arc' || data.source !== 'Circle Arc Earn Kit' || data.mode !== 'official-read-only' || !Array.isArray(data.vaults) || data.vaults.length > 1000 || !fresh(data.retrievedAt, now) || !address(vaultAddress)) return null;
  const matches = data.vaults.filter(vault => typeof vault?.vaultAddress === 'string' && vault.vaultAddress.toLowerCase() === vaultAddress.toLowerCase());
  if (matches.length !== 1) return null;
  const vault = matches[0];
  if (vault.asset !== 'USDC' || vault.status !== 'active' || !amount(vault.availableLiquidityAssetAmount) || (vault.liquidityAsOf !== null && !fresh(vault.liquidityAsOf, now))) return null;
  return Object.freeze({
    schema: 'cofferhouse.arc-earn.liquidity-source.v1', source: data.source, chain: data.chain,
    vaultAddress: vault.vaultAddress.toLowerCase(), name: String(vault.name ?? '').slice(0, 256), protocol: String(vault.protocol ?? '').slice(0, 128), asset: 'USDC',
    amountUsdc: vault.availableLiquidityAssetAmount, retrievedAt: data.retrievedAt,
    liquidityAsOf: vault.liquidityAsOf,
    reportedApyPct: typeof vault.apyPct === 'number' && Number.isFinite(vault.apyPct) && vault.apyPct >= 0 ? vault.apyPct : null,
    providerFreshnessVerified: false,
  });
}
export function earnLiquiditySources(data, options) {
  return Array.isArray(data?.vaults) && data.vaults.length <= 1000 ? data.vaults.map(vault => earnLiquiditySource(data, vault?.vaultAddress, options)).filter(Boolean) : [];
}
export function earnSourceIssues(source, data, { now = Date.now() } = {}) {
  if (source?.schema !== 'cofferhouse.arc-earn.liquidity-source.v1' || !address(source.vaultAddress) || !amount(source.amountUsdc) || source.asset !== 'USDC' || source.chain !== 'Arc') return ['EARN_SOURCE_UNAVAILABLE'];
  if (!fresh(source.retrievedAt, now) || (source.liquidityAsOf !== null && !fresh(source.liquidityAsOf, now))) return ['EARN_SOURCE_STALE'];
  const current = earnLiquiditySource(data, source.vaultAddress, { now });
  if (!current) return ['EARN_SOURCE_UNAVAILABLE'];
  if (fields.some(key => current[key] !== source[key])) return ['EARN_SOURCE_CHANGED'];
  return [];
}
export function planIdleUsdcWithEarn(input, source, data, { now = Date.now() } = {}) {
  const issues = earnSourceIssues(source, data, { now });
  if (input?.vaultAvailableLiquidityUsdc !== source?.amountUsdc) issues.push('EARN_LIQUIDITY_OVERRIDE');
  const base = planIdleUsdc(input, { now });
  const reasons = [...new Set([...base.reasons, ...issues])];
  const safeSource = source?.schema === 'cofferhouse.arc-earn.liquidity-source.v1' ? { ...Object.fromEntries(fields.map(key => [key, ['string', 'number', 'boolean'].includes(typeof source[key]) ? source[key] : null])), providerFreshnessVerified: false } : null;
  return { ...base, mode: 'EARN_LIQUIDITY_WITH_CALLER_ASSUMPTIONS',
    marketSource: safeSource,
    sourceReview: { status: issues.length ? 'BLOCKED' : 'PROVIDER_REPORT_MATCHES', reasons: issues, checkedAt: Number.isFinite(new Date(now).getTime()) ? new Date(now).toISOString() : null },
    decision: reasons.length ? 'KEEP_LIQUID' : 'REVIEW_REQUIRED', reasons,
    reviewableAllocationUsdc: reasons.length ? '0.000000' : base.reviewableAllocationUsdc,
  };
}
