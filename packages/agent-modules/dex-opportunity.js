export const defaultDexOpportunityPreferences = Object.freeze({
  minPoolScore: 55,
  minLiquidityUsd: 25_000,
  minVolume24hUsd: 1_000,
  maxAbsPriceChange24hPct: 50,
  maxModeledImpactPct: 2,
  includeReview: true
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeDexOpportunityPreferences(value = {}) {
  return {
    minPoolScore: Math.round(clamp(finite(value.minPoolScore, defaultDexOpportunityPreferences.minPoolScore), 0, 100)),
    minLiquidityUsd: clamp(finite(value.minLiquidityUsd, defaultDexOpportunityPreferences.minLiquidityUsd), 0, 100_000_000_000),
    minVolume24hUsd: clamp(finite(value.minVolume24hUsd, defaultDexOpportunityPreferences.minVolume24hUsd), 0, 100_000_000_000),
    maxAbsPriceChange24hPct: clamp(finite(value.maxAbsPriceChange24hPct, defaultDexOpportunityPreferences.maxAbsPriceChange24hPct), 0, 10_000),
    maxModeledImpactPct: clamp(finite(value.maxModeledImpactPct, defaultDexOpportunityPreferences.maxModeledImpactPct), 0.01, 100),
    includeReview: value.includeReview === undefined ? defaultDexOpportunityPreferences.includeReview : value.includeReview === true || value.includeReview === "on"
  };
}

export function analyzeDexOpportunities(reports, rawPreferences = {}, quoteStates = {}) {
  const preferences = normalizeDexOpportunityPreferences(rawPreferences);
  const candidates = reports.map((report) => {
    const blockers = [];
    const pool = report.pool;
    if (report.status === "REJECT") blockers.push("Pool fails a hard DEX screening limit.");
    if (report.status === "REVIEW" && !preferences.includeReview) blockers.push("Review-status pools are excluded by this profile.");
    if (report.score < preferences.minPoolScore) blockers.push("Pool score is below the opportunity minimum.");
    if (pool.liquidityUsd === null || pool.liquidityUsd < preferences.minLiquidityUsd) blockers.push("Pool liquidity is below the opportunity minimum.");
    if (pool.volume24hUsd === null || pool.volume24hUsd < preferences.minVolume24hUsd) blockers.push("24-hour volume is below the opportunity minimum.");
    if (pool.priceChange24hPct === null || Math.abs(pool.priceChange24hPct) > preferences.maxAbsPriceChange24hPct) blockers.push("24-hour price movement exceeds the opportunity maximum.");
    if (report.modeledLiquidityImpactPct === null || report.modeledLiquidityImpactPct > preferences.maxModeledImpactPct) blockers.push("Modeled liquidity impact exceeds the opportunity maximum.");
    const quoteState = quoteStates[pool.pairAddress];
    const quoteAvailable = quoteState?.state === "ready";
    const score = Math.round(clamp(report.score * 0.7 + Math.min((pool.volume24hUsd ?? 0) / Math.max(pool.liquidityUsd ?? 1, 1), 2) / 2 * 15 + Math.min((pool.liquidityUsd ?? 0) / Math.max(preferences.minLiquidityUsd, 1), 2) / 2 * 10 + (quoteAvailable ? 5 : 0), 0, 100));
    return {
      schema: "cofferhouse.dex.opportunity-candidate.v1",
      pairAddress: pool.pairAddress,
      pairName: `${pool.baseToken.symbol} / ${pool.quoteToken.symbol}`,
      observedAt: pool.observedAt,
      tokenAddress: pool.baseToken.address,
      eligible: blockers.length === 0,
      decision: blockers.length ? "BLOCKED_BY_DEX_LIMITS" : "ELIGIBLE_FOR_DEX_RESEARCH",
      opportunityScore: score,
      poolStatus: report.status,
      poolScore: report.score,
      liquidityUsd: pool.liquidityUsd,
      volume24hUsd: pool.volume24hUsd,
      priceChange24hPct: pool.priceChange24hPct,
      modeledImpactPct: report.modeledLiquidityImpactPct,
      speculativeApproval: pool.speculativeApproval,
      officialQuoteAvailable: quoteAvailable,
      quote: quoteAvailable ? quoteState.quote : null,
      blockers,
      warnings: report.checks.filter((item) => item.outcome === "review").map((item) => item.detail),
      reason: blockers[0] ?? "Clears the visible DEX research limits; human review remains required."
    };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.opportunityScore - a.opportunityScore || (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
  return {
    schema: "cofferhouse.dex.opportunity-analysis.v1",
    observedAt: candidates.map((item) => item.observedAt).filter(Boolean).sort().at(-1) ?? null,
    preferences,
    summary: { total: candidates.length, eligible: candidates.filter((item) => item.eligible).length, blocked: candidates.filter((item) => !item.eligible).length, quoted: candidates.filter((item) => item.officialQuoteAvailable).length },
    candidates,
    notice: "DEX research prioritization only. Speculative approval records scope and never removes warnings."
  };
}

const storageKey = "cofferhouse.dex.opportunity.preferences.v1";

export function loadDexOpportunityPreferences(storage) {
  try { return normalizeDexOpportunityPreferences(JSON.parse(storage?.getItem(storageKey) ?? "{}")); } catch { return { ...defaultDexOpportunityPreferences }; }
}

export function saveDexOpportunityPreferences(storage, value) {
  const preferences = normalizeDexOpportunityPreferences(value);
  storage?.setItem(storageKey, JSON.stringify(preferences));
  return preferences;
}
