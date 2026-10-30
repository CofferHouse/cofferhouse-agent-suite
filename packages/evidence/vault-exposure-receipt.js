import { sealDocument } from "./integrity.js";

export function createVaultExposureReceipt(observation, comparison = null) {
  if (observation?.schema !== "cofferhouse.morpho.vault-exposure.v1") throw new Error("A vault exposure observation is required.");
  return sealDocument({ schema: "cofferhouse.morpho.vault-exposure-receipt.v1", generatedAt: observation.observedAt, observation, comparison }, "vault-exposure");
}
