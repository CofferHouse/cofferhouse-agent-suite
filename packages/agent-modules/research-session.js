import { scanMarkets } from "../agent-core/index.js";
import { evaluateMarket } from "../policies/index.js";
import { analyzeOpportunities } from "./opportunity.js";
import { buildStrategy } from "./strategy.js";
import { analyzeDexOpportunities } from "./dex-opportunity.js";
import { buildDexStrategy } from "./dex-strategy.js";

export function runResearchSession({
  markets,
  policy,
  opportunityPreferences = {},
  strategyPreferences = {},
  dexReports = [],
  dexOpportunityPreferences = {},
  dexStrategyPreferences = {},
  dexQuoteStates = {},
  now = () => new Date().toISOString()
}) {
  if (!Array.isArray(markets) || markets.length === 0) throw new Error("At least one market observation is required.");
  if (!policy?.id || !policy?.version) throw new Error("A valid policy profile is required.");

  const scout = scanMarkets(markets, (market) => evaluateMarket(market, policy));
  const opportunities = analyzeOpportunities(markets, policy, opportunityPreferences);
  const strategy = buildStrategy(opportunities, strategyPreferences);
  const hasDexEvidence = Array.isArray(dexReports) && dexReports.length > 0;
  const dexOpportunities = hasDexEvidence ? analyzeDexOpportunities(dexReports, dexOpportunityPreferences, dexQuoteStates) : null;
  const dexStrategy = dexOpportunities ? buildDexStrategy(dexOpportunities, dexStrategyPreferences) : null;
  const generatedAt = typeof now === "function" ? now() : now;

  const stages = [
    { id: "scout", agent: "Scout", status: "COMPLETE", result: `${scout.counts.PASS} pass · ${scout.counts.REVIEW} review · ${scout.counts.REJECT} reject` },
    { id: "opportunity", agent: "Opportunity", status: "COMPLETE", result: `${opportunities.summary.eligible} of ${opportunities.summary.total} eligible for research` },
    { id: "strategy", agent: "Strategy", status: "COMPLETE", result: strategy.status === "PROPOSAL_READY" ? `${strategy.summary.markets} modeled position${strategy.summary.markets === 1 ? "" : "s"}` : "No eligible lending allocation" },
    { id: "dex", agent: "DEX", status: hasDexEvidence ? "COMPLETE" : "SKIPPED", result: hasDexEvidence ? `${dexOpportunities.summary.eligible} of ${dexOpportunities.summary.total} pools eligible` : "No observed pools; no DEX result invented" },
    { id: "action", agent: "Action Center", status: "WAITING_HUMAN", result: "Manual review required before a separate action preview" }
  ];

  return {
    schema: "cofferhouse.agent-hub.session.v1",
    generatedAt,
    observedAt: scout.observedAt,
    dataMode: markets.every((market) => market.dataMode === "live") ? "live" : "demo",
    policy: { id: policy.id, name: policy.name, version: policy.version },
    stages,
    summary: {
      marketsObserved: scout.total,
      marketsEligible: opportunities.summary.eligible,
      lendingPositions: strategy.summary.markets,
      dexPoolsObserved: hasDexEvidence ? dexOpportunities.summary.total : 0,
      dexPoolsEligible: hasDexEvidence ? dexOpportunities.summary.eligible : 0,
      dexPositions: dexStrategy?.summary.positions ?? 0,
      decision: strategy.status === "PROPOSAL_READY" || dexStrategy?.status === "PROPOSAL_READY" ? "RESEARCH_READY" : "NO_ELIGIBLE_ALLOCATION",
      humanGate: "REQUIRED"
    },
    outputs: { scout, opportunities, strategy, dexOpportunities, dexStrategy },
    execution: { prepared: false, signed: false, submitted: false },
    notice: "Coordinated read-only research. Results are not financial advice or execution authority. A separate human-reviewed action preview is required."
  };
}
