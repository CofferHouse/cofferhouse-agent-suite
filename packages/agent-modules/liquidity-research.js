export const defaultLiquidityFilters = Object.freeze({ minTvlUsd: 25000, minVolume24hUsd: 10000 });

export function normalizeLiquidityFilters(raw = {}) {
  const result = {};
  for (const [key, fallback] of Object.entries(defaultLiquidityFilters)) {
    const value = raw[key] === undefined || raw[key] === "" ? fallback : raw[key];
    if (!(typeof value === "number" || typeof value === "string" && /^\d{1,13}(\.\d{1,2})?$/.test(value)) || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e12) throw Error("Invalid liquidity research filters");
    result[key] = Number(value);
  }
  return result;
}

export function screenLiquidityPools(observation, rawFilters = {}) {
  const filters = normalizeLiquidityFilters(rawFilters);
  const candidates = observation.pools.map(pool => {
    const blockers = [];
    if (pool.tvlUsd === null || pool.tvlUsd < filters.minTvlUsd) blockers.push("TVL_BELOW_LIMIT_OR_UNKNOWN");
    if (pool.volume24hUsd === null || pool.volume24hUsd < filters.minVolume24hUsd) blockers.push("VOLUME_BELOW_LIMIT_OR_UNKNOWN");
    if (pool.providerBlacklisted !== false) blockers.push("BLACKLISTED_OR_UNKNOWN");
    if ([pool.tokenX, pool.tokenY].some(token => token.freezeAuthorityDisabled !== true)) blockers.push("TOKEN_FREEZE_CONTROL_UNVERIFIED");
    return { ...pool, matchesFilters: !blockers.length, decision: blockers.length ? "FILTERED_OUT" : "REVIEW_REQUIRED", blockers };
  });
  return { ...observation, filters, candidates, matches: candidates.filter(pool => pool.matchesFilters).length, execution: { enabled: false, signed: false, submitted: false } };
}
