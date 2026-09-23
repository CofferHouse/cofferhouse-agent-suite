import { evaluateMarket } from "./policy.js";

const statusOrder = { PASS: 0, REVIEW: 1, REJECT: 2 };

export function scanMarkets(markets, evaluator = evaluateMarket) {
  const ranked = markets.map((market) => {
    const report = evaluator(market);
    const firstWarning = report.warnings[0];

    return {
      market,
      report,
      reason: firstWarning?.detail ?? "Every active policy check passed."
    };
  }).sort((a, b) =>
    statusOrder[a.report.status] - statusOrder[b.report.status]
    || b.report.score - a.report.score
    || (b.market.liquidityUsd ?? -1) - (a.market.liquidityUsd ?? -1)
    || a.market.name.localeCompare(b.market.name)
  );

  const counts = ranked.reduce((total, item) => {
    total[item.report.status] += 1;
    return total;
  }, { PASS: 0, REVIEW: 0, REJECT: 0 });

  return {
    ranked,
    counts,
    total: ranked.length,
    actionable: ranked.filter((item) => item.report.status === "PASS").length,
    observedAt: ranked[0]?.market.observedAt ?? null
  };
}
