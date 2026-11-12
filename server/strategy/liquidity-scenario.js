import { evaluateLiquidityScenario } from "../../packages/agent-modules/liquidity-scenario.js";

// Stateless paper calculation only. No provider requests, persistence or execution.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  const input = request.body;
  if (!input || typeof input !== "object" || Array.isArray(input)) return response.status(400).json({ ok: false, error: "A JSON object with all scenario assumptions is required" });
  const names = ["capitalUsd", "principalUsd", "positionFeesUsd", "costsUsd", "holdingValueUsd", "stressPrincipalUsd", "feeHaircutPct", "minProfitUsd", "maxStressLossPct", "horizonDays"];
  if (Object.keys(input).some(name => !names.includes(name))) return response.status(400).json({ ok: false, error: "Unknown scenario field" });
  try {
    const scenario = evaluateLiquidityScenario(input);
    return response.status(200).json({ ok: true, scenario });
  } catch { return response.status(400).json({ ok: false, error: "Invalid LP scenario assumptions" }); }
}
