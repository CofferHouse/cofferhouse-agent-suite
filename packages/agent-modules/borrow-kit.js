const amount = (value) => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const pct = (ratio) => amount(ratio) === null ? null : amount(ratio) * 100;

export function healthFactorBand(value) {
  const health = amount(value);
  if (health === null) return "UNAVAILABLE";
  if (health < 1) return "LIQUIDATABLE";
  if (health < 1.05) return "IMMINENT";
  if (health < 1.1) return "URGENT";
  if (health < 1.2) return "WARN";
  return "SAFE";
}

export function normalizeBorrowMarket(value = {}) {
  return Object.freeze({
    marketId: String(value.marketId ?? ""), protocol: String(value.protocol ?? "unknown"), chain: String(value.chain ?? "Arc"),
    loanAsset: String(value.loanAsset?.symbol ?? "Unknown"), collateralAsset: String(value.collateralAsset?.symbol ?? "Unknown"),
    liquidityUsd: amount(value.liquidity?.amount), borrowApyPct: pct(value.borrowApy), utilizationPct: pct(value.utilization),
    lltvPct: pct(value.lltv), refreshedAt: value.refreshedAt ?? null
  });
}

export function normalizeBorrowMarkets(payload = {}) {
  const markets = Array.isArray(payload.markets) ? payload.markets.map(normalizeBorrowMarket).sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1)) : [];
  return Object.freeze({ schema: "cofferhouse.arc-app-kits.borrow-markets.v1", source: "Circle Arc Borrow Kit", chain: "Arc", observedAt: payload.observedAt ?? new Date().toISOString(), markets });
}

export function normalizeBorrowPreview(payload = {}) {
  const market = normalizeBorrowMarket(payload.market);
  const healthFactor = amount(payload.quote?.resultingHealthFactor);
  const requiredCollateral = amount(payload.quote?.requiredCollateral?.amount);
  const liquidationPrice = amount(payload.quote?.liquidationPrice?.amount);
  return Object.freeze({
    schema: "cofferhouse.arc-app-kits.borrow-preview.v1", source: "Circle Arc Borrow Kit", chain: "Arc",
    observedAt: payload.observedAt ?? new Date().toISOString(), market,
    borrowAmountUsdc: Number(payload.borrowAmount ?? payload.request?.borrowAmount ?? 0),
    targetHealthFactor: Number(payload.targetHealthFactor ?? payload.request?.targetHealthFactor ?? healthFactor),
    requiredCollateral: Object.freeze({ token: String(payload.quote?.requiredCollateral?.token ?? "cirBTC"), amount: requiredCollateral }),
    resultingHealthFactor: healthFactor, healthFactorBand: healthFactorBand(healthFactor),
    liquidationPrice: Object.freeze({ token: String(payload.quote?.liquidationPrice?.token ?? "USD"), amount: liquidationPrice }),
    warnings: Object.freeze([
      ...(market.utilizationPct >= 95 ? ["Market utilization is at or above 95%; available liquidity and borrowing capacity may change quickly."] : []),
      ...(healthFactor !== null && healthFactor < 1.2 ? ["The modeled health factor is below Borrow Kit's SAFE band."] : []),
      ...(healthFactor === null ? ["Loan health is unavailable; do not treat this preview as a valid execution quote."] : []),
      "Borrow rates, collateral price and liquidation price can change before a wallet action."
    ]),
    execution: Object.freeze({ walletConnected: false, approvalPrepared: false, transactionPrepared: false, submitted: false }),
    notice: "Read-only Borrow Kit sizing preview. No wallet adapter, approval, signature, loan or transaction was created."
  });
}

export async function fetchArcBorrowMarkets(fetcher = globalThis.fetch) {
  const response = await fetcher("/api/app-kits/borrow", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Borrow Kit markets request failed (${response.status}).`);
  return normalizeBorrowMarkets(await response.json());
}

export async function requestBorrowPreview({ marketId, borrowAmount, targetHealthFactor }, fetcher = globalThis.fetch) {
  const response = await fetcher("/api/app-kits/borrow", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ marketId, borrowAmount, targetHealthFactor }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Borrow Kit preview failed (${response.status}).`);
  return normalizeBorrowPreview({ ...payload, request: { borrowAmount, targetHealthFactor } });
}
