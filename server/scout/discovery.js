import { discoverMorphoMarkets } from "../../packages/arc-data/morpho-discovery.js";
export function createDiscoveryHandler({ discover = discoverMorphoMarkets } = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") return response.status(405).json({ok:false,error:"Method not allowed"});
    const params = new URL(request.url, "https://cofferhouse.invalid").searchParams;
    const chains = request.query?.chains ?? params.get("chains");
    const asset = request.query?.asset ?? params.get("asset") ?? "";
    if (typeof chains !== "string" || !/^(5042|8453|1)(,(5042|8453|1)){0,2}$/.test(chains)) return response.status(400).json({ok:false,error:"Select supported networks"});
    try {
      const networks = await discover({chainIds:chains.split(",").map(Number),asset});
      return response.status(200).json({ok:true,networks});
    } catch {
      return response.status(400).json({ok:false,error:"Invalid discovery filters"});
    }
  };
}
export default createDiscoveryHandler();
