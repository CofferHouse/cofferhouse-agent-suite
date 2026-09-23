export const ARC_CHAIN_ID = 5042;
export const ARC_USDC = "0x3600000000000000000000000000000000000000";

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const finiteOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function normalizeUniswapQuote(payload) {
  const quote = payload?.quote;
  if (!payload?.requestId || !quote || !payload.routing) throw new Error("Uniswap returned an incomplete quote.");
  const outputRaw = quote.output?.amount ?? quote.aggregatedOutputs?.[0]?.amount ?? null;
  const outputDecimals = Number.isInteger(payload.outputDecimals) ? payload.outputDecimals : null;
  const outputAmount = outputRaw !== null && outputDecimals !== null ? Number(outputRaw) / (10 ** outputDecimals) : null;
  return {
    schema: "cofferhouse.dex.uniswap-quote.v1",
    requestId: payload.requestId,
    routing: payload.routing,
    tokenIn: quote.input?.token ?? payload.tokenIn ?? null,
    tokenOut: quote.output?.token ?? payload.tokenOut ?? null,
    inputRaw: quote.input?.amount ?? null,
    outputRaw,
    outputDecimals,
    outputAmount: Number.isFinite(outputAmount) ? outputAmount : null,
    minimumOutputRaw: quote.output?.minimumAmount ?? quote.aggregatedOutputs?.[0]?.minAmount ?? null,
    slippageTolerancePct: finiteOrNull(quote.slippageTolerance ?? payload.slippageTolerance),
    priceImpactPct: finiteOrNull(quote.priceImpact),
    gasEstimateUsd: finiteOrNull(quote.classicGasUseEstimateUSD ?? quote.gasFeeUSD),
    approvalMayBeRequired: payload.isTokenApprovalApplicable !== false,
    simulated: payload.txFailureReason ? false : true,
    failureReason: payload.txFailureReason ?? null,
    route: quote.route ?? quote.orderInfo?.outputs?.map((item) => item.token) ?? [],
    quotedAt: new Date().toISOString(),
    notice: "Read-only quote. No approval, signature, calldata submission or transaction was requested."
  };
}

export async function requestUniswapQuote({ tokenOut, amountUsd, slippageTolerancePct = 0.5 }, fetchImpl = fetch) {
  if (!ADDRESS.test(tokenOut)) throw new Error("A valid output token contract is required.");
  const response = await fetchImpl("/api/dex/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ tokenIn: ARC_USDC, tokenOut, amountUsd, slippageTolerancePct })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Uniswap quote failed (${response.status}).`);
  return normalizeUniswapQuote(payload);
}
