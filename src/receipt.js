const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function createScoutReceipt(scan, policy) {
  const results = scan.ranked.map(({ market, report, reason }) => ({
    marketId: market.marketId,
    market: market.name,
    network: market.network,
    status: report.status,
    score: report.score,
    reason,
    liquidityUsd: market.liquidityUsd,
    utilizationPct: market.utilizationPct,
    supplyApyPct: market.apyPct,
    borrowApyPct: market.borrowApyPct ?? null,
    lltvPct: market.lltvPct ?? null,
    oracleAddress: market.oracleAddress ?? null,
    observedAt: market.observedAt
  }));
  const fingerprintInput = JSON.stringify({ policy, results });

  return {
    schema: "cofferhouse.scout.receipt.v1",
    receiptId: `scout-${stableHash(fingerprintInput)}`,
    generatedAt: scan.observedAt,
    policy,
    summary: { total: scan.total, ...scan.counts, actionable: scan.actionable },
    results,
    notice: "Read-only research output. Human review required. Not financial advice."
  };
}

export function downloadScoutReceipt(receipt, documentRef = document) {
  const blob = new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = `${receipt.receiptId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
