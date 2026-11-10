import { sealDocument } from "./integrity.js";

export function createScoutDiscoveryReceipt(filters, networks, generatedAt = new Date().toISOString()) {
  if (!networks.some(({ status }) => status === "FOUND" || status === "NO_MATCH")) return null;
  const { chains, asset, minLiquidityUsd, maxUtilizationPct } = filters;
  return sealDocument({
    schema: "cofferhouse.scout.discovery-receipt.v1",
    generatedAt,
    source: "Morpho Blue",
    filters: { chains, asset, minLiquidityUsd, maxUtilizationPct },
    networks,
    notice: "Read-only research. Results reflect the sampled markets and filters, not complete coverage or investment approval. The integrity hash does not authenticate the data source."
  }, "scout-discovery");
}
