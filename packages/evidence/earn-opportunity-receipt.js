import { sealDocument } from "./integrity.js";

export function createEarnOpportunityReceipt(analysis) {
  if (analysis?.schema !== "cofferhouse.arc-app-kits.earn-analysis.v1") throw new Error("A valid Earn opportunity analysis is required.");
  return sealDocument({
    schema: "cofferhouse.arc-app-kits.earn-receipt.v1",
    generatedAt: analysis.observedAt,
    sourceAgent: "CofferHouse Opportunity Agent · Arc Earn Kit",
    source: analysis.source,
    chain: analysis.chain,
    preferences: analysis.preferences,
    summary: analysis.summary,
    opportunities: analysis.opportunities,
    notice: analysis.notice
  }, "earn-opportunity");
}
