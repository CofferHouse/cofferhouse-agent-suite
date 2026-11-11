// A single-position, fixed-horizon paper scenario. Fees must be position-specific
// and excluded from principal valuations; this is not inferred from pool TVL.
export function evaluateLiquidityScenario(input) {
  const names = ["capitalUsd", "principalUsd", "positionFeesUsd", "costsUsd", "holdingValueUsd", "stressPrincipalUsd", "feeHaircutPct", "minProfitUsd", "maxStressLossPct", "horizonDays"];
  for (const name of names) {
    const value = input[name];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12) throw Error("Invalid LP scenario assumptions");
  }
  if (input.capitalUsd <= 0 || input.feeHaircutPct > 100 || input.maxStressLossPct > 100 || !Number.isInteger(input.horizonDays) || input.horizonDays < 1 || input.horizonDays > 365) throw Error("Invalid LP scenario assumptions");
  const cents = value => Math.round(value * 100) / 100;
  const netValue = input.principalUsd + input.positionFeesUsd - input.costsUsd;
  const netPnl = netValue - input.capitalUsd;
  const versusHolding = netValue - input.holdingValueUsd;
  const stressPnl = input.stressPrincipalUsd + input.positionFeesUsd * (1 - input.feeHaircutPct / 100) - input.costsUsd - input.capitalUsd;
  const blockers = [];
  if (netPnl < input.minProfitUsd) blockers.push("PROFIT_BELOW_TARGET");
  if (versusHolding < 0) blockers.push("UNDERPERFORMS_HOLDING");
  if (stressPnl < -input.capitalUsd * input.maxStressLossPct / 100) blockers.push("STRESS_LOSS_ABOVE_LIMIT");
  return {
    schema: "cofferhouse.liquidity.paper-scenario.v1",
    assumptions: Object.fromEntries(names.map(name => [name, input[name]])), netPnlUsd: cents(netPnl), versusHoldingUsd: cents(versusHolding),
    stressPnlUsd: cents(stressPnl),
    requiredPositionFeesUsd: cents(Math.max(0, Math.max(input.capitalUsd + input.minProfitUsd, input.holdingValueUsd) + input.costsUsd - input.principalUsd)),
    decision: blockers.length ? "OUTSIDE_PAPER_LIMITS" : "WITHIN_PAPER_LIMITS", blockers,
    execution: { enabled: false, signed: false, submitted: false },
    notice: "Manual assumptions, not a forecast. No capital flows are modeled. Principal excludes fees. Pool aggregate fees are not position earnings."
  };
}
