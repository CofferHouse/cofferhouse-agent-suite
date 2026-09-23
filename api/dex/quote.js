const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ARC_CHAIN_ID = 5042;
const USDC = "0x3600000000000000000000000000000000000000";
const RESEARCH_SWAPPER = "0x0000000000000000000000000000000000000001";

async function tokenDecimals(address) {
  if (address.toLowerCase() === USDC) return 6;
  if (!process.env.ARC_RPC_URL) return null;
  const rpc = await fetch(process.env.ARC_RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: address, data: "0x313ce567" }, "latest"] }) });
  const payload = await rpc.json();
  if (!rpc.ok || payload.error || !payload.result) return null;
  const decimals = Number.parseInt(payload.result, 16);
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : null;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  if (!process.env.UNISWAP_API_KEY) return response.status(503).json({ error: "Official Uniswap quotes are not configured on this deployment." });
  const tokenIn = String(request.body?.tokenIn ?? USDC).toLowerCase();
  const tokenOut = String(request.body?.tokenOut ?? "").toLowerCase();
  const amountUsd = Number(request.body?.amountUsd);
  const slippageTolerancePct = Number(request.body?.slippageTolerancePct ?? 0.5);
  if (tokenIn !== USDC) return response.status(400).json({ error: "This read-only quote currently supports Arc USDC as input only." });
  if (!ADDRESS.test(tokenOut) || tokenOut === USDC) return response.status(400).json({ error: "A valid non-USDC output token is required." });
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 1_000_000) return response.status(400).json({ error: "Quote amount must be between 0 and 1,000,000 USD." });
  if (!Number.isFinite(slippageTolerancePct) || slippageTolerancePct < 0.01 || slippageTolerancePct > 50) return response.status(400).json({ error: "Slippage tolerance must be between 0.01% and 50%." });
  const amount = BigInt(Math.round(amountUsd * 1_000_000)).toString();
  try {
    const upstream = await fetch("https://trade-api.gateway.uniswap.org/v1/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": process.env.UNISWAP_API_KEY,
        "x-universal-router-version": "2.1.2",
        "x-permit2-disabled": "true",
        "x-agent-info": JSON.stringify({ decision_origin: "human_mediated", integration_name: "CofferHouse Scout", version: "0.1.0" })
      },
      body: JSON.stringify({ type: "EXACT_INPUT", amount, tokenInChainId: ARC_CHAIN_ID, tokenOutChainId: ARC_CHAIN_ID, tokenIn, tokenOut, swapper: RESEARCH_SWAPPER, slippageTolerance: slippageTolerancePct, routingPreference: "BEST_PRICE", permitAmount: "EXACT" })
    });
    const payload = await upstream.json();
    if (!upstream.ok) return response.status(upstream.status === 401 ? 502 : upstream.status).json({ error: payload.detail ?? payload.errorCode ?? payload.error ?? `Uniswap returned ${upstream.status}.` });
    return response.status(200).json({ ...payload, tokenIn, tokenOut, outputDecimals: await tokenDecimals(tokenOut), slippageTolerance: slippageTolerancePct });
  } catch (error) {
    return response.status(502).json({ error: error.message ?? "Uniswap quote service unavailable." });
  }
}
