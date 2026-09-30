import { sealDocument } from "./integrity.js";

export function createDexOpportunityReceipt(analysis) {
  if (analysis?.schema !== "cofferhouse.dex.opportunity-analysis.v1") throw new Error("A valid DEX opportunity analysis is required.");
  return sealDocument({
    schema: "cofferhouse.dex.opportunity-receipt.v1",
    generatedAt: analysis.observedAt ?? "unobserved",
    sourceAgent: "CofferHouse DEX Opportunity Agent",
    preferences: analysis.preferences,
    summary: analysis.summary,
    candidates: analysis.candidates,
    notice: analysis.notice
  }, "dex-opportunity");
}

export function createDexStrategyReceipt(proposal) {
  if (proposal?.schema !== "cofferhouse.dex.strategy-proposal.v1") throw new Error("A valid DEX strategy proposal is required.");
  return sealDocument({
    schema: "cofferhouse.dex.strategy-receipt.v1",
    generatedAt: proposal.observedAt ?? "unobserved",
    sourceAgent: "CofferHouse DEX Strategy Lab",
    mode: proposal.mode,
    preferences: proposal.preferences,
    status: proposal.status,
    summary: proposal.summary,
    positions: proposal.positions,
    impermanentLossReferencePct: proposal.impermanentLossReferencePct,
    notice: proposal.notice
  }, "dex-strategy");
}
