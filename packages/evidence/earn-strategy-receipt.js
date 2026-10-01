import { sealDocument } from "./integrity.js";

export function createEarnStrategyReceipt(proposal) {
  if (proposal?.schema !== "cofferhouse.arc-app-kits.earn-strategy.v1") throw new Error("A valid Earn strategy proposal is required.");
  return sealDocument({
    schema: "cofferhouse.arc-app-kits.earn-strategy-receipt.v1", generatedAt: proposal.observedAt,
    sourceAgent: "CofferHouse Strategy Lab · Arc Earn Kit", sourceSchema: proposal.sourceSchema,
    source: proposal.source, chain: proposal.chain, preferences: proposal.preferences, status: proposal.status,
    summary: proposal.summary, positions: proposal.positions, exclusions: proposal.exclusions,
    separationRule: proposal.separationRule, notice: proposal.notice
  }, "earn-strategy");
}
