import { scanMarkets } from "./agent.js";
import { agentDecision } from "./agent-runtime.js";
import { compareMarketSnapshots } from "./monitor.js";
import { evaluateMarket } from "./policy.js";

export function runAgentCycle({ currentMarkets, previousMarkets = null, policy, limits, now = () => new Date() }) {
  if (!Array.isArray(currentMarkets) || currentMarkets.length === 0) {
    throw new Error("Agent cycle requires at least one current market observation.");
  }

  const evaluator = (market) => evaluateMarket(market, policy);
  const scan = scanMarkets(currentMarkets, evaluator);
  const comparison = previousMarkets?.length
    ? compareMarketSnapshots(previousMarkets, currentMarkets, policy, evaluateMarket, limits)
    : { previousObservedAt: null, currentObservedAt: scan.observedAt, materialChanges: 0, changes: [] };
  const decision = agentDecision(comparison, scan);
  const ranAt = now().toISOString();
  const trace = [
    { phase: "OBSERVE", status: "COMPLETE", detail: `${scan.total} market observations normalized.`, at: ranAt },
    { phase: "EVALUATE", status: "COMPLETE", detail: `${scan.total} markets evaluated with ${policy.version}.`, at: ranAt },
    { phase: "COMPARE", status: previousMarkets?.length ? "COMPLETE" : "BASELINE", detail: previousMarkets?.length ? `${comparison.materialChanges} material changes detected.` : "No prior durable snapshot; baseline created.", at: ranAt },
    { phase: "DECIDE", status: "COMPLETE", detail: `${decision.action}: ${decision.reason}`, at: ranAt }
  ];

  return {
    schema: "cofferhouse.scout.agent-cycle.v1",
    ranAt,
    policy: { id: policy.id, name: policy.name, version: policy.version },
    observation: {
      marketCount: scan.total,
      observedAt: scan.observedAt,
      counts: scan.counts,
      actionable: scan.actionable
    },
    comparison,
    decision,
    trace,
    markets: currentMarkets
  };
}
