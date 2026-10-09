import { scanMarkets } from "../agent-core/index.js";
import { evaluateMarket } from "../policies/index.js";
import { analyzeOpportunities } from "./opportunity.js";
import { buildStrategy } from "./strategy.js";
import { analyzeDexOpportunities } from "./dex-opportunity.js";
import { buildDexStrategy } from "./dex-strategy.js";

function createHandoffs(strategy, dexStrategy) {
  const lending = strategy.positions[0];
  const dex = dexStrategy?.positions?.[0];
  const selected = lending
    ? { source: "LENDING", targetId: lending.marketId, targetName: lending.marketName, amountUsd: lending.amountUsd, reason: `Highest-ranked bounded lending position with research score ${lending.researchScore}.`, conditions: lending.exitConditions }
    : dex
      ? { source: dexStrategy.mode === "LP" ? "DEX_LP" : "DEX_SWAP", targetId: dex.pairAddress, targetName: dex.pairName, amountUsd: dex.amountUsd, reason: `Highest-ranked bounded ${dexStrategy.mode} position with opportunity score ${dex.opportunityScore}.`, conditions: dex.riskConditions }
      : null;
  if (!selected) return { action: { status: "SKIPPED", candidate: null, requiredHumanStep: null }, guardian: { status: "SKIPPED", target: null, activationRequires: [] } };
  return {
    action: { status: "READY_FOR_HUMAN_PREVIEW", candidate: selected, requiredHumanStep: "Open Action Center, inspect every check and create a separate read-only preview." },
    guardian: {
      status: "READY_AFTER_APPROVAL",
      target: { id: selected.targetId, name: selected.targetName, source: selected.source },
      proposedLimits: { liquidityDropPct: 10, utilizationRisePoints: 5, maxAbsPriceChange24hPct: 50, maxModeledImpactPct: 2 },
      activationRequires: ["Read-only Action Center preview", "Fresh human approval", "Current target evidence"],
      authority: { monitor: true, alert: true, rebalance: false, withdraw: false, swap: false }
    }
  };
}

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
  const handoffs = createHandoffs(strategy, dexStrategy);

  const stages = [
    { id: "scout", agent: "Scout", status: "COMPLETE", result: `${scout.counts.PASS} pass · ${scout.counts.REVIEW} review · ${scout.counts.REJECT} reject` },
    { id: "opportunity", agent: "Opportunity", status: "COMPLETE", result: `${opportunities.summary.eligible} eligible · ${opportunities.summary.watchlist} watchlist · ${opportunities.summary.blocked} blocked` },
    { id: "strategy", agent: "Strategy", status: "COMPLETE", result: strategy.status === "PROPOSAL_READY" ? `${strategy.summary.markets} modeled position${strategy.summary.markets === 1 ? "" : "s"}` : "No eligible lending allocation" },
    { id: "dex", agent: "DEX", status: hasDexEvidence ? "COMPLETE" : "SKIPPED", result: hasDexEvidence ? `${dexOpportunities.summary.eligible} of ${dexOpportunities.summary.total} pools eligible` : "No observed pools; no DEX result invented" },
    { id: "action", agent: "Action Center", status: handoffs.action.candidate ? "READY_FOR_HUMAN" : "SKIPPED", result: handoffs.action.candidate ? `${handoffs.action.candidate.targetName} · ${handoffs.action.candidate.amountUsd} USD modeled` : "No eligible strategy position to preview" },
    { id: "guardian", agent: "Guardian", status: handoffs.guardian.target ? "READY_AFTER_APPROVAL" : "SKIPPED", result: handoffs.guardian.target ? `Monitoring plan prepared for ${handoffs.guardian.target.name}` : "No approved research target to monitor" }
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
      marketsWatchlist: opportunities.summary.watchlist,
      lendingPositions: strategy.summary.markets,
      dexPoolsObserved: hasDexEvidence ? dexOpportunities.summary.total : 0,
      dexPoolsEligible: hasDexEvidence ? dexOpportunities.summary.eligible : 0,
      dexPositions: dexStrategy?.summary.positions ?? 0,
      actionCandidates: handoffs.action.candidate ? 1 : 0,
      guardianCandidates: handoffs.guardian.target ? 1 : 0,
      decision: strategy.status === "PROPOSAL_READY" || dexStrategy?.status === "PROPOSAL_READY" ? "RESEARCH_READY" : "NO_ELIGIBLE_ALLOCATION",
      humanGate: "REQUIRED"
    },
    outputs: { scout, opportunities, strategy, dexOpportunities, dexStrategy },
    handoffs,
    execution: { prepared: false, signed: false, submitted: false },
    notice: "Coordinated read-only research. Results are not financial advice or execution authority. A separate human-reviewed action preview is required."
  };
}
