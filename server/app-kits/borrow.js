import { BorrowKit } from "@circle-fin/borrow-kit";

const kit = new BorrowKit({ disableErrorReporting: true });
const marketIdPattern = /^0x[a-fA-F0-9]{64}$/;
const validAmount = (value) => /^\d+(\.\d{1,6})?$/.test(String(value ?? "")) && Number(value) > 0 && Number(value) <= 1_000_000;

async function cirBtcMarkets() {
  const result = await kit.exploreMarkets({ chain: "Arc", sortBy: "borrowApy" });
  return (result.markets ?? []).filter((market) => market.collateralAsset?.symbol === "cirBTC" && market.loanAsset?.symbol === "USDC");
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ ok: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", request.method === "GET" ? "public, s-maxage=30, stale-while-revalidate=120" : "no-store");
  try {
    const markets = await cirBtcMarkets();
    if (request.method === "GET") return response.status(200).json({ ok: true, source: "Circle Arc Borrow Kit", chain: "Arc", observedAt: new Date().toISOString(), markets });
    if (Number(request.headers?.["content-length"] ?? 0) > 8_192) return response.status(413).json({ ok: false, error: "Request body too large" });
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    const marketId = String(body.marketId ?? "");
    const borrowAmount = String(body.borrowAmount ?? "");
    const targetHealthFactor = Number(body.targetHealthFactor);
    if (!marketIdPattern.test(marketId)) return response.status(400).json({ ok: false, error: "A complete Borrow Kit market ID is required." });
    if (!validAmount(borrowAmount)) return response.status(400).json({ ok: false, error: "Borrow amount must be greater than zero and no more than 1,000,000 USDC." });
    if (!Number.isFinite(targetHealthFactor) || targetHealthFactor < 1.2 || targetHealthFactor > 5) return response.status(400).json({ ok: false, error: "Target health factor must be between 1.2 and 5.0." });
    const market = markets.find((item) => item.marketId.toLowerCase() === marketId.toLowerCase());
    if (!market) return response.status(404).json({ ok: false, error: "The selected cirBTC/USDC market is not currently returned by Borrow Kit." });
    if (Number(borrowAmount) > Number(market.liquidity?.amount ?? 0)) return response.status(422).json({ ok: false, error: "Requested borrow exceeds currently reported market liquidity." });
    const quote = await kit.getRequiredCollateral({ chain: "Arc", marketId: market.marketId, borrowAmount, targetHealthFactor });
    return response.status(200).json({ ok: true, source: "Circle Arc Borrow Kit", chain: "Arc", observedAt: new Date().toISOString(), market, quote, execution: { walletConnected: false, approvalPrepared: false, transactionPrepared: false, submitted: false } });
  } catch (error) {
    const status = error?.type === "INPUT" ? 400 : error?.type === "RATE_LIMIT" ? 429 : error?.type === "NETWORK" ? 504 : 502;
    return response.status(status).json({ ok: false, source: "Circle Arc Borrow Kit", error: error?.message ?? "Borrow Kit is unavailable.", recoverability: error?.recoverability ?? "UNKNOWN" });
  }
}
