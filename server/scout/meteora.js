import { fetchMeteoraPools } from "../../packages/arc-data/meteora.js";
import { normalizeLiquidityFilters, screenLiquidityPools } from "../../packages/agent-modules/liquidity-research.js";

export function createMeteoraHandler({ read = fetchMeteoraPools } = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
    let filters;
    const params = new URL(request.url, "https://cofferhouse.invalid").searchParams;
    try { filters = normalizeLiquidityFilters({ minTvlUsd: params.get("minTvlUsd") ?? undefined, minVolume24hUsd: params.get("minVolume24hUsd") ?? undefined }); }
    catch { return response.status(400).json({ ok: false, error: "Invalid liquidity research filters" }); }
    try {
      const observation = await read();
      return response.status(200).json({ ok: true, observation: screenLiquidityPools(observation, filters) });
    } catch { return response.status(502).json({ ok: false, error: "Liquidity research unavailable" }); }
  };
}
export default createMeteoraHandler();
