import { discoveryNetworks, normalizeDiscoveryMarket } from "./morpho-discovery.js";

export function networkMarketIdentity(chainId, marketId) {
  if (!discoveryNetworks.some(n=>n.id === chainId) || typeof marketId !== "string" || !/^0x[0-9a-f]{64}$/i.test(marketId)) throw Error("Invalid network market identity.");
  return `eip155:${chainId}:morpho-blue:${marketId.toLowerCase()}`;
}

export async function fetchNetworkMarket({chainId,marketId}, {fetcher=globalThis.fetch} = {}) {
  networkMarketIdentity(chainId,marketId);
  const response = await fetcher("https://api.morpho.org/graphql", {
    method:"POST", redirect:"error", signal:AbortSignal.timeout(10000), headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query:`query WatchedMarket($market: String!) {
      marketById(marketId: $market, chainId: ${chainId}) {
        marketId chain { id } listed loanAsset { address symbol } collateralAsset { address symbol }
        state { liquidityAssetsUsd utilization supplyApy }
      }
    }`,variables:{market:marketId.toLowerCase()}})
  });
  if (!response.ok) throw Error("Market source unavailable.");
  const body=await response.json(), item=body.data?.marketById;
  if (body.errors?.length || !item || item.marketId?.toLowerCase() !== marketId.toLowerCase()) throw Error("Exact market is not observable.");
  return {...normalizeDiscoveryMarket(item,chainId,{requireListed:false}),observedAt:new Date().toISOString()};
}
