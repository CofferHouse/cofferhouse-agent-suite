import { sealDocument } from "./integrity.js";
export function createGatewayReceipt(observation) {
  if (observation?.schema !== "cofferhouse.gateway.observation.v1") throw new Error("A Gateway observation is required.");
  return sealDocument({ schema: "cofferhouse.gateway.receipt.v1", generatedAt: observation.observedAt, observation }, "gateway");
}
