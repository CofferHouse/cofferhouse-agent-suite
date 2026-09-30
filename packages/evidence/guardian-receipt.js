import { sealDocument } from "./integrity.js";

export function createGuardianReceipt(watch, observation) {
  if (watch?.schema !== "cofferhouse.guardian.watch.v1" || observation?.schema !== "cofferhouse.guardian.observation.v1") throw new Error("A valid Guardian watch and observation are required.");
  return sealDocument({ schema: "cofferhouse.guardian.receipt.v1", generatedAt: observation.observedAt, sourceAgent: "CofferHouse Guardian", watch, observation, execution: { automatedAction: false, transactionHash: null }, notice: "Monitoring evidence only. Any future action must return through Action Center." }, "guardian");
}
