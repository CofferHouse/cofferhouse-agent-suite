const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const STORAGE_KEY = "cofferhouse.dex.watchlist.v1";

export const defaultDexPolicy = Object.freeze({
  minLiquidityUsd: 25_000,
  rejectLiquidityBelowUsd: 5_000,
  minVolume24hUsd: 1_000,
  maxPriceChange24hPct: 35,
  maxModeledLiquidityImpactPct: 2,
  minPoolAgeHours: 24
});

const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function isEvmAddress(value) { return ADDRESS.test(String(value ?? "")); }

export function normalizeDexWatchlist(items = []) {
  const seen = new Set();
  return items.flatMap((item) => {
    const address = String(typeof item === "string" ? item : item?.address ?? "").trim().toLowerCase();
    if (!isEvmAddress(address) || seen.has(address)) return [];
    seen.add(address);
    return [{
      address,
      label: String(item?.label ?? "User-selected token").trim().slice(0, 48) || "User-selected token",
      speculativeApproval: item?.speculativeApproval === true,
      addedAt: item?.addedAt ?? null
    }];
  });
}

export function loadDexWatchlist(storage) {
  try { return normalizeDexWatchlist(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]")); }
  catch { return []; }
}

export function saveDexWatchlist(storage, items) {
  const normalized = normalizeDexWatchlist(items);
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { /* Browser storage is optional. */ }
  return normalized;
}

export function normalizeDexPair(pair, userSelection = null) {
  const createdAt = numberOrNull(pair.pairCreatedAt);
  const ageHours = createdAt === null ? null : Math.max(0, (Date.now() - createdAt) / 3_600_000);
  return {
    schema: "cofferhouse.dex.pool-observation.v1",
    chainId: pair.chainId,
    dexId: pair.dexId ?? "unknown",
    pairAddress: String(pair.pairAddress ?? "").toLowerCase(),
    pairUrl: pair.url ?? null,
    baseToken: { address: String(pair.baseToken?.address ?? "").toLowerCase(), name: pair.baseToken?.name ?? "Unknown", symbol: pair.baseToken?.symbol ?? "?" },
    quoteToken: { address: String(pair.quoteToken?.address ?? "").toLowerCase(), name: pair.quoteToken?.name ?? "Unknown", symbol: pair.quoteToken?.symbol ?? "?" },
    priceUsd: numberOrNull(pair.priceUsd),
    liquidityUsd: numberOrNull(pair.liquidity?.usd),
    volume24hUsd: numberOrNull(pair.volume?.h24),
    buys24h: numberOrNull(pair.txns?.h24?.buys),
    sells24h: numberOrNull(pair.txns?.h24?.sells),
    priceChange24hPct: numberOrNull(pair.priceChange?.h24),
    fdvUsd: numberOrNull(pair.fdv),
    marketCapUsd: numberOrNull(pair.marketCap),
    poolAgeHours: ageHours,
    observedAt: new Date().toISOString(),
    userSelected: Boolean(userSelection),
    speculativeApproval: userSelection?.speculativeApproval === true,
    source: "DEX Screener API",
    rawProviderSchema: pair.schemaVersion ?? null
  };
}

export function evaluateDexPool(pool, rawPolicy = defaultDexPolicy, modeledSwapUsd = 1_000) {
  const policy = { ...defaultDexPolicy, ...rawPolicy };
  const checks = [];
  const add = (id, outcome, detail, value) => checks.push({ id, outcome, detail, value });
  if (pool.chainId !== "arc" && pool.chainId !== "5042") add("network", "reject", "Pool is not identified as Arc mainnet.", pool.chainId);
  else add("network", "pass", "Pool is identified as Arc mainnet.", pool.chainId);
  if (!isEvmAddress(pool.pairAddress)) add("identity", "reject", "Pool contract address is missing or invalid.", pool.pairAddress);
  else add("identity", "pass", "Pool has a valid EVM contract identity.", pool.pairAddress);
  if (pool.liquidityUsd === null) add("liquidity", "review", "USD liquidity is unavailable.", null);
  else if (pool.liquidityUsd < policy.rejectLiquidityBelowUsd) add("liquidity", "reject", "Liquidity is below the hard DEX floor.", pool.liquidityUsd);
  else if (pool.liquidityUsd < policy.minLiquidityUsd) add("liquidity", "review", "Liquidity is below the preferred DEX floor.", pool.liquidityUsd);
  else add("liquidity", "pass", "Liquidity clears the preferred DEX floor.", pool.liquidityUsd);
  if (pool.volume24hUsd === null) add("volume", "review", "24-hour volume is unavailable.", null);
  else if (pool.volume24hUsd < policy.minVolume24hUsd) add("volume", "review", "24-hour volume is below the activity minimum.", pool.volume24hUsd);
  else add("volume", "pass", "Pool has observable 24-hour trading activity.", pool.volume24hUsd);
  if (pool.priceChange24hPct === null) add("volatility", "review", "24-hour price change is unavailable.", null);
  else if (Math.abs(pool.priceChange24hPct) > policy.maxPriceChange24hPct) add("volatility", "review", "Observed 24-hour price movement exceeds the profile limit.", pool.priceChange24hPct);
  else add("volatility", "pass", "Observed 24-hour price movement remains inside the profile limit.", pool.priceChange24hPct);
  if (pool.poolAgeHours === null) add("age", "review", "Pool creation time is unavailable.", null);
  else if (pool.poolAgeHours < policy.minPoolAgeHours) add("age", "review", "Pool is newer than the minimum observation window.", pool.poolAgeHours);
  else add("age", "pass", "Pool clears the minimum age window.", pool.poolAgeHours);
  const liquidityImpactPct = pool.liquidityUsd && pool.liquidityUsd > 0 ? modeledSwapUsd / pool.liquidityUsd * 100 : null;
  if (liquidityImpactPct === null) add("modeledImpact", "review", "Liquidity impact cannot be modeled without liquidity.", null);
  else if (liquidityImpactPct > policy.maxModeledLiquidityImpactPct) add("modeledImpact", "reject", "Modeled swap size exceeds the liquidity-impact limit.", liquidityImpactPct);
  else add("modeledImpact", "pass", "Modeled swap size remains inside the liquidity-impact limit.", liquidityImpactPct);
  add("tokenEvidence", "review", "Token controls, holder concentration, taxes and sellability require independent verification.", null);

  const status = checks.some((item) => item.outcome === "reject") ? "REJECT" : checks.some((item) => item.outcome === "review") ? "REVIEW" : "PASS";
  const penalty = checks.reduce((sum, item) => sum + (item.outcome === "reject" ? 25 : item.outcome === "review" ? 8 : 0), 0);
  return {
    schema: "cofferhouse.dex.pool-report.v1",
    status,
    score: clamp(100 - penalty, 0, 100),
    label: pool.speculativeApproval ? "USER-APPROVED SPECULATIVE" : "STANDARD RESEARCH",
    modeledSwapUsd,
    modeledLiquidityImpactPct: liquidityImpactPct,
    pool,
    policy,
    checks,
    firstAttention: checks.find((item) => item.outcome !== "pass")?.detail ?? "Every available DEX check passed.",
    notice: "Research only. User selection never overrides a warning or rejection. Liquidity impact is a screening ratio, not an executable quote."
  };
}
