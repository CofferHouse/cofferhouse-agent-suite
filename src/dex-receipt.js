import { sealDocument } from "./integrity.js";

export function createDexReceipt(reports, watchlist, modeledSwapUsd) {
  if (!Array.isArray(reports)) throw new Error("DEX pool reports are required.");
  const generatedAt = reports.map((item) => item.pool.observedAt).filter(Boolean).sort().at(-1) ?? new Date().toISOString();
  return sealDocument({
    schema: "cofferhouse.dex.pool-receipt.v1",
    generatedAt,
    sourceAgent: "CofferHouse DEX Pool Scanner",
    modeledSwapUsd,
    watchlist,
    summary: {
      pools: reports.length,
      PASS: reports.filter((item) => item.status === "PASS").length,
      REVIEW: reports.filter((item) => item.status === "REVIEW").length,
      REJECT: reports.filter((item) => item.status === "REJECT").length
    },
    reports,
    notice: "Read-only DEX screening. User selection does not override warnings. Modeled liquidity impact is not an executable quote, recommendation, signature or transaction."
  }, "dex-pools");
}
