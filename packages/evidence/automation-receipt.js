import { sealDocument } from "./integrity.js";

export function createAutomationReceipt(policy, evaluation = null) {
  if (policy?.schema !== "cofferhouse.automation.policy.v1") throw new Error("A valid Automation policy is required.");
  if (evaluation && evaluation.schema !== "cofferhouse.automation.evaluation.v1") throw new Error("A valid Automation evaluation is required.");
  return sealDocument({ schema: "cofferhouse.automation.receipt.v1", generatedAt: evaluation?.evaluatedAt ?? policy.createdAt, sourceAgent: "CofferHouse Automation Sandbox", policy, evaluation, installed: false, execution: { attempted: false, signed: false, submitted: false }, notice: "This receipt proves simulated limits and evaluation only; no permission was installed onchain." }, "automation");
}
