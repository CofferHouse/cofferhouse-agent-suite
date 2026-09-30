import { sealDocument } from "./integrity.js";

export function createInteropReceipt(observation) {
  if (observation?.schema !== "cofferhouse.interop.observation.v1") throw new Error("A valid Interop observation is required.");
  return sealDocument({
    schema: "cofferhouse.interop.receipt.v1",
    generatedAt: observation.observedAt,
    sourceAgent: "CofferHouse Interop Observer",
    observation,
    execution: { bridge: false, swap: false, settlement: false, transactionSubmitted: false },
    notice: "Read-only CCTP event evidence. This receipt is not a bridge quote, FX quote or proof of an end-to-end route."
  }, "interop");
}
