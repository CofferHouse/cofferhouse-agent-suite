import { discoverMorphoMarkets, discoveryNetworks } from "../../packages/arc-data/morpho-discovery.js";
const supportedChains = new Set(discoveryNetworks.map(network => String(network.id)));
export function createDiscoveryHandler({ discover = discoverMorphoMarkets } = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") return response.status(405).json({ok:false,error:"Method not allowed"});
    const params = new URL(request.url, "https://cofferhouse.invalid").searchParams;
    const chains = request.query?.chains ?? params.get("chains");
    const asset = request.query?.asset ?? params.get("asset") ?? "";
    const minLiquidityUsd = request.query?.minLiquidityUsd ?? params.get("minLiquidityUsd") ?? "";
    const maxUtilizationPct = request.query?.maxUtilizationPct ?? params.get("maxUtilizationPct") ?? "";
    const chainIds = typeof chains === "string" && chains.length <= discoveryNetworks.length * 5 ? chains.split(",") : [];
    if (!chainIds.length || chainIds.length > supportedChains.size || new Set(chainIds).size !== chainIds.length || chainIds.some(id => !supportedChains.has(id))) return response.status(400).json({ok:false,error:"Select supported networks"});
    try {
      const networks = await discover({chainIds:chainIds.map(Number),asset,minLiquidityUsd,maxUtilizationPct});
      return response.status(200).json({ok:true,networks});
    } catch {
      return response.status(400).json({ok:false,error:"Invalid discovery filters"});
    }
  };
}
export default createDiscoveryHandler();
