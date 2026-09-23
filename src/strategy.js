export const defaultStrategyPreferences = Object.freeze({
  capitalUsd: 10_000,
  reservePct: 15,
  maxMarkets: 3,
  maxPerMarketPct: 50,
  minResearchScore: 60
});

const STORAGE_KEY = "cofferhouse.strategy.preferences.v1";
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normalizeStrategyPreferences(value = {}) {
  return {
    capitalUsd: clamp(finiteOr(value.capitalUsd, defaultStrategyPreferences.capitalUsd), 1, 1_000_000_000),
    reservePct: clamp(finiteOr(value.reservePct, defaultStrategyPreferences.reservePct), 0, 90),
    maxMarkets: Math.round(clamp(finiteOr(value.maxMarkets, defaultStrategyPreferences.maxMarkets), 1, 8)),
    maxPerMarketPct: clamp(finiteOr(value.maxPerMarketPct, defaultStrategyPreferences.maxPerMarketPct), 5, 100),
    minResearchScore: Math.round(clamp(finiteOr(value.minResearchScore, defaultStrategyPreferences.minResearchScore), 0, 100))
  };
}

export function loadStrategyPreferences(storage) {
  try { return normalizeStrategyPreferences(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "{}")); }
  catch { return { ...defaultStrategyPreferences }; }
}

export function saveStrategyPreferences(storage, preferences) {
  const normalized = normalizeStrategyPreferences(preferences);
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { /* Keep state in memory. */ }
  return normalized;
}

function allocateWithCaps(candidates, deployableUsd, perMarketCapUsd) {
  const allocations = candidates.map((candidate) => ({ candidate, amountUsd: 0 }));
  let remaining = deployableUsd;
  let active = allocations.slice();
  for (let pass = 0; pass < allocations.length + 1 && remaining > 0.005 && active.length; pass += 1) {
    const totalWeight = active.reduce((sum, item) => sum + Math.max(item.candidate.researchScore, 1), 0);
    let distributed = 0;
    const next = [];
    for (const item of active) {
      const room = Math.max(0, Math.min(perMarketCapUsd, item.candidate.maxResearchAmountUsd) - item.amountUsd);
      const share = remaining * (Math.max(item.candidate.researchScore, 1) / totalWeight);
      const addition = Math.min(room, share);
      item.amountUsd += addition;
      distributed += addition;
      if (room - addition > 0.005) next.push(item);
    }
    if (distributed <= 0.005) break;
    remaining -= distributed;
    active = next;
  }
  return { allocations, unallocatedUsd: Math.max(0, remaining) };
}

export function buildStrategy(opportunityAnalysis, rawPreferences = {}) {
  if (opportunityAnalysis?.schema !== "cofferhouse.opportunity.analysis.v1") throw new Error("A valid Opportunity analysis is required.");
  const preferences = normalizeStrategyPreferences(rawPreferences);
  const reserveUsd = preferences.capitalUsd * preferences.reservePct / 100;
  const deployableUsd = preferences.capitalUsd - reserveUsd;
  const perMarketCapUsd = preferences.capitalUsd * preferences.maxPerMarketPct / 100;
  const candidates = opportunityAnalysis.opportunities
    .filter((item) => item.eligible && item.researchScore >= preferences.minResearchScore && item.maxResearchAmountUsd > 0)
    .slice(0, preferences.maxMarkets);
  const allocation = allocateWithCaps(candidates, deployableUsd, perMarketCapUsd);
  const positions = allocation.allocations
    .filter((item) => item.amountUsd > 0.005)
    .map(({ candidate, amountUsd }) => ({
      marketId: candidate.marketId,
      selectedMarketId: candidate.selectedMarketId,
      marketName: candidate.marketName,
      amountUsd: Math.round(amountUsd * 100) / 100,
      portfolioPct: Math.round(amountUsd / preferences.capitalUsd * 10_000) / 100,
      observedSupplyApyPct: candidate.supplyApyPct,
      annualizedObservedYieldUsd: Math.round(amountUsd * (candidate.supplyApyPct ?? 0) / 100 * 100) / 100,
      researchScore: candidate.researchScore,
      scoutStatus: candidate.scoutStatus,
      exitConditions: [
        `Review if utilization rises above ${opportunityAnalysis.preferences.maxUtilizationPct}%.`,
        `Review if available liquidity falls below ${opportunityAnalysis.preferences.minLiquidityUsd} USD.`,
        `Stop research eligibility if Scout changes to REJECT or required evidence becomes unavailable.`
      ]
    }));
  const allocatedUsd = positions.reduce((sum, item) => sum + item.amountUsd, 0);
  const unallocatedUsd = Math.round((preferences.capitalUsd - reserveUsd - allocatedUsd) * 100) / 100;
  const observedAnnualizedYieldUsd = positions.reduce((sum, item) => sum + item.annualizedObservedYieldUsd, 0);
  const weightedObservedApyPct = allocatedUsd > 0 ? observedAnnualizedYieldUsd / allocatedUsd * 100 : 0;
  const status = positions.length ? "PROPOSAL_READY" : "NO_ELIGIBLE_ALLOCATION";

  return {
    schema: "cofferhouse.strategy.proposal.v1",
    sourceSchema: opportunityAnalysis.schema,
    policy: opportunityAnalysis.policy,
    preferences,
    status,
    observedAt: opportunityAnalysis.observedAt,
    dataMode: opportunityAnalysis.dataMode,
    summary: {
      capitalUsd: preferences.capitalUsd,
      reserveUsd: Math.round(reserveUsd * 100) / 100,
      allocatedUsd: Math.round(allocatedUsd * 100) / 100,
      unallocatedUsd,
      markets: positions.length,
      weightedObservedApyPct: Math.round(weightedObservedApyPct * 1000) / 1000,
      observedAnnualizedYieldUsd: Math.round(observedAnnualizedYieldUsd * 100) / 100
    },
    positions,
    exclusions: opportunityAnalysis.opportunities.filter((item) => !positions.some((position) => position.marketId === item.marketId)).map((item) => ({ marketId: item.marketId, marketName: item.marketName, reason: !item.eligible ? item.reason : item.researchScore < preferences.minResearchScore ? "Research score is below the Strategy minimum." : "Excluded by diversification or sizing limits." })),
    notice: "Read-only allocation research. Observed APY is variable, not forecast or guaranteed. No recommendation, custody, signature or execution."
  };
}
