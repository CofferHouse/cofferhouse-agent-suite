import { sealDocument } from "./integrity.js";

export function createStrategyReceipt(proposal) {
  if (proposal?.schema !== "cofferhouse.strategy.proposal.v1") throw new Error("A valid Strategy proposal is required.");
  return sealDocument({
    schema: "cofferhouse.strategy.receipt.v1",
    generatedAt: proposal.observedAt,
    sourceAgent: "CofferHouse Strategy Lab",
    sourceSchema: proposal.sourceSchema,
    policy: proposal.policy,
    preferences: proposal.preferences,
    status: proposal.status,
    summary: proposal.summary,
    positions: proposal.positions,
    exclusions: proposal.exclusions,
    notice: proposal.notice
  }, "strategy");
}
