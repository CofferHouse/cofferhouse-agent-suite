import { evaluateMarket } from "./policy.js";

const percentChange = (before, after) => before > 0 ? ((after - before) / before) * 100 : null;

export function compareMarketSnapshots(previousMarkets, currentMarkets, activePolicy, evaluator = evaluateMarket, limits = {}) {
  const liquidityThreshold = Number.isFinite(limits.liquidityChangePct) ? limits.liquidityChangePct : 5;
  const utilizationThreshold = Number.isFinite(limits.utilizationChangePts) ? limits.utilizationChangePts : 2;
  const previousById = new Map(previousMarkets.map((market) => [market.marketId, market]));
  const changes = [];

  for (const market of currentMarkets) {
    const previous = previousById.get(market.marketId);
    if (!previous) {
      changes.push({ marketId: market.marketId, market: market.name, level: "review", type: "new", message: "New listed market detected." });
      continue;
    }

    const liquidityChangePct = percentChange(previous.liquidityUsd, market.liquidityUsd);
    const utilizationChangePts = Number.isFinite(previous.utilizationPct) && Number.isFinite(market.utilizationPct)
      ? market.utilizationPct - previous.utilizationPct : null;
    const previousReport = evaluator(previous, activePolicy);
    const currentReport = evaluator(market, activePolicy);

    if (previousReport.status !== currentReport.status) {
      changes.push({
        marketId: market.marketId,
        market: market.name,
        level: currentReport.status === "REJECT" ? "reject" : "review",
        type: "status",
        message: `Policy result changed from ${previousReport.status} to ${currentReport.status}.`
      });
    }
    if (liquidityChangePct !== null && Math.abs(liquidityChangePct) >= liquidityThreshold) {
      changes.push({
        marketId: market.marketId,
        market: market.name,
        level: liquidityChangePct < 0 ? "review" : "info",
        type: "liquidity",
        message: `Available liquidity ${liquidityChangePct < 0 ? "fell" : "rose"} ${Math.abs(liquidityChangePct).toFixed(1)}%.`
      });
    }
    if (utilizationChangePts !== null && Math.abs(utilizationChangePts) >= utilizationThreshold) {
      changes.push({
        marketId: market.marketId,
        market: market.name,
        level: utilizationChangePts > 0 ? "review" : "info",
        type: "utilization",
        message: `Utilization ${utilizationChangePts > 0 ? "rose" : "fell"} ${Math.abs(utilizationChangePts).toFixed(1)} points.`
      });
    }
  }

  const currentIds = new Set(currentMarkets.map((market) => market.marketId));
  for (const market of previousMarkets) {
    if (!currentIds.has(market.marketId)) {
      changes.push({ marketId: market.marketId, market: market.name, level: "review", type: "removed", message: "Previously listed market is no longer returned." });
    }
  }

  const priority = { reject: 0, review: 1, info: 2 };
  changes.sort((a, b) => priority[a.level] - priority[b.level] || a.market.localeCompare(b.market));

  return {
    previousObservedAt: previousMarkets[0]?.observedAt ?? null,
    currentObservedAt: currentMarkets[0]?.observedAt ?? null,
    materialChanges: changes.length,
    changes
  };
}
