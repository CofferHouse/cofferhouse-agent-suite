import { evaluateMarket } from "./policy.js";

export const defaultOpportunityPreferences = Object.freeze({
  capitalUsd: 10_000,
  minSupplyApyPct: 0,
  minLiquidityUsd: 1_000_000,
  maxUtilizationPct: 85,
  maxMarketImpactPct: 1
});
const OPPORTUNITY_STORAGE_KEY = "cofferhouse.opportunity.preferences.v1";

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normalizeOpportunityPreferences(value = {}) {
  return {
    capitalUsd: clamp(finiteOr(value.capitalUsd, defaultOpportunityPreferences.capitalUsd), 1, 1_000_000_000),
    minSupplyApyPct: clamp(finiteOr(value.minSupplyApyPct, defaultOpportunityPreferences.minSupplyApyPct), 0, 1_000),
    minLiquidityUsd: clamp(finiteOr(value.minLiquidityUsd, defaultOpportunityPreferences.minLiquidityUsd), 0, 100_000_000_000),
    maxUtilizationPct: clamp(finiteOr(value.maxUtilizationPct, defaultOpportunityPreferences.maxUtilizationPct), 1, 100),
    maxMarketImpactPct: clamp(finiteOr(value.maxMarketImpactPct, defaultOpportunityPreferences.maxMarketImpactPct), 0.01, 10)
  };
}

export function loadOpportunityPreferences(storage) {
  try {
    return normalizeOpportunityPreferences(JSON.parse(storage?.getItem(OPPORTUNITY_STORAGE_KEY) ?? "{}"));
  } catch {
    return { ...defaultOpportunityPreferences };
  }
}

export function saveOpportunityPreferences(storage, preferences) {
  const normalized = normalizeOpportunityPreferences(preferences);
  try {
    storage?.setItem(OPPORTUNITY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Keep normalized preferences in memory when storage is unavailable.
  }
  return normalized;
}

function researchScore(market, report, preferences) {
  const policyComponent = report.score * 0.65;
  const liquidityBase = preferences.minLiquidityUsd > 0 ? preferences.minLiquidityUsd : 1;
  const liquidityComponent = Math.min(Math.max((market.liquidityUsd ?? 0) / liquidityBase, 0), 2) / 2 * 15;
  const utilizationComponent = Number.isFinite(market.utilizationPct)
    ? Math.max(0, (preferences.maxUtilizationPct - market.utilizationPct) / preferences.maxUtilizationPct) * 10
    : 0;
  const yieldReference = Math.max(preferences.minSupplyApyPct, 5);
  const yieldComponent = Number.isFinite(market.apyPct)
    ? Math.min(Math.max(market.apyPct / yieldReference, 0), 2) / 2 * 10
    : 0;
  return Math.round(policyComponent + liquidityComponent + utilizationComponent + yieldComponent);
}

export function analyzeOpportunities(markets, activePolicy, rawPreferences = {}, evaluator = evaluateMarket) {
  const preferences = normalizeOpportunityPreferences(rawPreferences);
  const opportunities = markets.map((market) => {
    const report = evaluator(market, activePolicy);
    const blockers = [];
    if (!Number.isFinite(market.liquidityUsd)) blockers.push("Available liquidity is missing.");
    else if (market.liquidityUsd <= 0) blockers.push("No available liquidity is reported.");
    else if (market.liquidityUsd < preferences.minLiquidityUsd) blockers.push("Available liquidity is below your opportunity minimum.");
    if (!Number.isFinite(market.utilizationPct)) blockers.push("Market utilization is missing.");
    else if (market.utilizationPct < 0 || market.utilizationPct > 100) blockers.push("Market utilization is outside a valid percentage range.");
    else if (market.utilizationPct > preferences.maxUtilizationPct) blockers.push("Market utilization exceeds your opportunity maximum.");
    if (!Number.isFinite(market.apyPct)) blockers.push("Supply APY is missing.");
    else if (market.apyPct < preferences.minSupplyApyPct) blockers.push("Supply APY is below your opportunity minimum.");
    if (report.status === "REJECT") blockers.push("Market fails a hard limit in the active Scout policy.");

    const impactBound = Number.isFinite(market.liquidityUsd) ? market.liquidityUsd * (preferences.maxMarketImpactPct / 100) : 0;
    const maxResearchAmountUsd = Math.max(0, Math.min(preferences.capitalUsd, impactBound));
    const eligible = blockers.length === 0;
    const score = researchScore(market, report, preferences);
    const warnings = report.warnings.map((warning) => warning.detail);
    if (maxResearchAmountUsd < preferences.capitalUsd && maxResearchAmountUsd > 0) {
      warnings.unshift(`Sizing is capped at ${preferences.maxMarketImpactPct}% of observed liquidity.`);
    }

    return {
      marketId: market.marketId,
      marketName: market.name,
      selectedMarketId: market.id,
      eligible,
      decision: eligible ? "ELIGIBLE_FOR_RESEARCH" : "BLOCKED_BY_LIMITS",
      researchScore: score,
      scoutStatus: report.status,
      scoutScore: report.score,
      liquidityUsd: market.liquidityUsd,
      utilizationPct: market.utilizationPct,
      supplyApyPct: market.apyPct,
      maxResearchAmountUsd,
      blockers,
      warnings,
      reason: eligible ? "Clears your opportunity limits; human research is still required." : blockers[0],
      observedAt: market.observedAt,
      dataMode: market.dataMode
    };
  }).sort((a, b) =>
    Number(b.eligible) - Number(a.eligible)
    || b.researchScore - a.researchScore
    || (b.supplyApyPct ?? -1) - (a.supplyApyPct ?? -1)
    || (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1)
    || a.marketName.localeCompare(b.marketName)
  );

  return {
    schema: "cofferhouse.opportunity.analysis.v1",
    policy: { id: activePolicy.id, name: activePolicy.name, version: activePolicy.version },
    preferences,
    observedAt: opportunities[0]?.observedAt ?? null,
    dataMode: opportunities.every((item) => item.dataMode === "live") ? "live" : "demo",
    summary: {
      total: opportunities.length,
      eligible: opportunities.filter((item) => item.eligible).length,
      blocked: opportunities.filter((item) => !item.eligible).length
    },
    opportunities
  };
}
