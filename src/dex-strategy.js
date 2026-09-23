const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const defaultDexStrategyPreferences = Object.freeze({ capitalUsd: 5_000, reservePct: 25, maxPools: 3, maxPerPoolPct: 40, mode: "SWAP" });

export function impermanentLossReference(priceRatio) {
  if (!Number.isFinite(priceRatio) || priceRatio <= 0) return null;
  return (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * 100;
}

export function normalizeDexStrategyPreferences(value = {}) {
  return {
    capitalUsd: clamp(finite(value.capitalUsd, defaultDexStrategyPreferences.capitalUsd), 1, 1_000_000_000),
    reservePct: clamp(finite(value.reservePct, defaultDexStrategyPreferences.reservePct), 0, 90),
    maxPools: Math.round(clamp(finite(value.maxPools, defaultDexStrategyPreferences.maxPools), 1, 8)),
    maxPerPoolPct: clamp(finite(value.maxPerPoolPct, defaultDexStrategyPreferences.maxPerPoolPct), 5, 100),
    mode: value.mode === "LP" ? "LP" : "SWAP"
  };
}

export function buildDexStrategy(analysis, rawPreferences = {}) {
  if (analysis?.schema !== "cofferhouse.dex.opportunity-analysis.v1") throw new Error("A valid DEX opportunity analysis is required.");
  const preferences = normalizeDexStrategyPreferences(rawPreferences);
  const reserveUsd = preferences.capitalUsd * preferences.reservePct / 100;
  const deployableUsd = preferences.capitalUsd - reserveUsd;
  const maxPerPoolUsd = preferences.capitalUsd * preferences.maxPerPoolPct / 100;
  const selected = analysis.candidates.filter((item) => item.eligible).slice(0, preferences.maxPools);
  const totalWeight = selected.reduce((sum, item) => sum + Math.max(item.opportunityScore, 1), 0);
  let remaining = deployableUsd;
  const positions = selected.map((candidate) => {
    const weighted = totalWeight ? deployableUsd * candidate.opportunityScore / totalWeight : 0;
    const liquidityCap = (candidate.liquidityUsd ?? 0) * 0.01;
    const amountUsd = Math.round(Math.min(weighted, maxPerPoolUsd, liquidityCap, remaining) * 100) / 100;
    remaining -= amountUsd;
    return {
      pairAddress: candidate.pairAddress,
      pairName: candidate.pairName,
      tokenAddress: candidate.tokenAddress,
      amountUsd,
      portfolioPct: Math.round(amountUsd / preferences.capitalUsd * 10_000) / 100,
      opportunityScore: candidate.opportunityScore,
      officialQuoteAvailable: candidate.officialQuoteAvailable,
      quote: preferences.mode === "SWAP" ? candidate.quote : null,
      riskConditions: preferences.mode === "SWAP" ? ["Re-quote before any human-authorized action.", "Review if liquidity or route availability deteriorates.", "Stop if token controls, taxes or sellability cannot be verified."] : ["Fee yield is unavailable until verified fee history is connected.", "Concentrated-liquidity range behavior is not modeled by the reference IL formula.", "Review token controls, pool hooks and withdrawal path before any LP decision."]
    };
  }).filter((item) => item.amountUsd > 0);
  const allocatedUsd = positions.reduce((sum, item) => sum + item.amountUsd, 0);
  return {
    schema: "cofferhouse.dex.strategy-proposal.v1",
    observedAt: analysis.observedAt,
    mode: preferences.mode,
    preferences,
    status: positions.length ? "PROPOSAL_READY" : "NO_ELIGIBLE_ALLOCATION",
    summary: { capitalUsd: preferences.capitalUsd, reserveUsd: Math.round(reserveUsd * 100) / 100, allocatedUsd: Math.round(allocatedUsd * 100) / 100, unallocatedUsd: Math.round((preferences.capitalUsd - reserveUsd - allocatedUsd) * 100) / 100, positions: positions.length },
    positions,
    impermanentLossReferencePct: preferences.mode === "LP" ? { priceDown50Pct: impermanentLossReference(0.5), priceUp100Pct: impermanentLossReference(2), priceUp300Pct: impermanentLossReference(4) } : null,
    notice: preferences.mode === "LP" ? "LP research only. Reference impermanent loss assumes a full-range constant-product pool and excludes fees; concentrated positions can behave materially differently." : "Swap allocation research only. Quotes expire and must be refreshed before any separately authorized action."
  };
}

const storageKey = "cofferhouse.dex.strategy.preferences.v1";

export function loadDexStrategyPreferences(storage) {
  try { return normalizeDexStrategyPreferences(JSON.parse(storage?.getItem(storageKey) ?? "{}")); } catch { return { ...defaultDexStrategyPreferences }; }
}

export function saveDexStrategyPreferences(storage, value) {
  const preferences = normalizeDexStrategyPreferences(value);
  storage?.setItem(storageKey, JSON.stringify(preferences));
  return preferences;
}
