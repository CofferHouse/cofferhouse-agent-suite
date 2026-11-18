import { evaluateLiquidityCashflows } from "../../packages/agent-modules/liquidity-cashflows.js";
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const input = request.body;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["historyReceipt", "costs"].includes(k))) throw Error();
    return response.status(200).json({ ok: true, cashflows: evaluateLiquidityCashflows(input.historyReceipt, input.costs ?? []) });
  } catch { return response.status(400).json({ ok: false, error: "Invalid history receipt or transaction cost entries" }); }
}
