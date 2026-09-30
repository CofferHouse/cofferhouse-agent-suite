import { sealDocument } from "./integrity.js";

export function createOpportunityReceipt(analysis) {
  if (analysis?.schema !== "cofferhouse.opportunity.analysis.v1") throw new Error("A valid opportunity analysis is required.");
  return sealDocument({
    schema: "cofferhouse.opportunity.receipt.v1",
    generatedAt: analysis.observedAt,
    sourceAgent: "CofferHouse Opportunity Agent",
    policy: analysis.policy,
    preferences: analysis.preferences,
    summary: analysis.summary,
    opportunities: analysis.opportunities,
    notice: "Research prioritization only. No investment recommendation, transaction, custody or execution. Human review required."
  }, "opportunity");
}
