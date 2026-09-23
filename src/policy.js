export const policy = {
  version: "scout-demo-0.1",
  minLiquidityUsd: 5_000_000,
  rejectLiquidityUsd: 1_000_000,
  maxUtilizationPct: 80,
  rejectUtilizationPct: 90,
  maxDataAgeMinutes: 15,
  minOracleCount: 2,
  maxVolatilityPct: 55,
  minCompletenessPct: 90
};

const rule = (id, label, value, outcome, detail) => ({ id, label, value, outcome, detail });

export function evaluateMarket(market, activePolicy = policy) {
  const rules = [];

  rules.push(market.network === "Arc"
    ? rule("network", "Supported network", market.network, "pass", "Market is deployed on the supported network.")
    : rule("network", "Supported network", market.network, "reject", "Only Arc markets are supported."));

  const liquidityOutcome = market.liquidityUsd === null || market.liquidityUsd === undefined
    ? "review"
    : market.liquidityUsd < activePolicy.rejectLiquidityUsd
    ? "reject"
    : market.liquidityUsd < activePolicy.minLiquidityUsd ? "review" : "pass";
  rules.push(rule("liquidity", "Available liquidity", market.liquidityUsd, liquidityOutcome,
    liquidityOutcome === "pass" ? "Liquidity clears the policy minimum." : "Liquidity is below the preferred safety buffer."));

  const utilizationOutcome = market.utilizationPct === null || market.utilizationPct === undefined
    ? "review"
    : market.utilizationPct >= activePolicy.rejectUtilizationPct
    ? "reject"
    : market.utilizationPct > activePolicy.maxUtilizationPct ? "review" : "pass";
  rules.push(rule("utilization", "Market utilization", market.utilizationPct, utilizationOutcome,
    utilizationOutcome === "pass" ? "Utilization leaves an acceptable liquidity buffer." : "High utilization may limit exits or borrowing capacity."));

  rules.push(rule("contract", "Contract status", market.contractStatus,
    market.contractStatus === "allowlisted" ? "pass" : market.contractStatus === "blocked" ? "reject" : "review",
    market.contractStatus === "allowlisted" ? "Contract is on the local policy allowlist." : market.contractStatus === "listed" ? "Protocol-listed market; CofferHouse verification is still pending." : "Contract needs explicit human verification."));

  rules.push(rule("freshness", "Data freshness", market.ageMinutes,
    market.ageMinutes <= activePolicy.maxDataAgeMinutes ? "pass" : "review",
    market.ageMinutes <= activePolicy.maxDataAgeMinutes ? "Observation is within the freshness window." : "Observation is older than the policy permits."));

  rules.push(rule("oracles", "Independent price sources", market.oracleCount,
    market.oracleCount >= activePolicy.minOracleCount ? "pass" : "review",
    market.oracleCount >= activePolicy.minOracleCount ? "Multiple price sources reduce single-source dependence." : "A second independent price source is required."));

  rules.push(rule("volatility", "Collateral volatility", market.collateralVolatilityPct,
    market.collateralVolatilityPct === null || market.collateralVolatilityPct === undefined ? "review" : market.collateralVolatilityPct <= activePolicy.maxVolatilityPct ? "pass" : "review",
    market.collateralVolatilityPct === null || market.collateralVolatilityPct === undefined ? "No verified volatility feed is connected; human review is required." : market.collateralVolatilityPct <= activePolicy.maxVolatilityPct ? "Volatility remains inside the configured bound." : "Volatility requires tighter collateral and liquidation limits."));

  rules.push(rule("completeness", "Required data present", market.completenessPct,
    market.completenessPct >= activePolicy.minCompletenessPct ? "pass" : "reject",
    market.completenessPct >= activePolicy.minCompletenessPct ? "Required fields are present." : "Required data is missing; evaluation fails safely."));

  const status = rules.some((item) => item.outcome === "reject")
    ? "REJECT"
    : rules.some((item) => item.outcome === "review") ? "REVIEW" : "PASS";
  const weights = { pass: 12.5, review: 6, reject: 0 };
  const score = Math.round(rules.reduce((total, item) => total + weights[item.outcome], 0));
  const warnings = rules.filter((item) => item.outcome !== "pass");

  return {
    status,
    score,
    rules,
    warnings,
    policyVersion: activePolicy.version,
    summary: status === "PASS"
      ? "This market clears every active Scout policy."
      : status === "REVIEW"
        ? `${warnings.length} item${warnings.length === 1 ? "" : "s"} require human review before use.`
        : "A hard safety limit was triggered. Scout would not permit this market."
  };
}
