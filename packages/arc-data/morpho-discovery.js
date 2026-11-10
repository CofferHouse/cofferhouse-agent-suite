export const discoveryNetworks = Object.freeze([
  Object.freeze({ id: 5042, name: "Arc" }),
  Object.freeze({ id: 8453, name: "Base" }),
  Object.freeze({ id: 1, name: "Ethereum" }),
  Object.freeze({ id: 4663, name: "Robinhood Chain" })
]);
export const discoveryLimit = 20;
const address = /^0x[0-9a-f]{40}$/i;
const marketId = /^0x[0-9a-f]{64}$/i;
const token = /^[a-z0-9][a-z0-9._-]{0,19}$/i;
const query = id => `query ScoutDiscovery {
  markets(first: ${discoveryLimit}, orderBy: SupplyAssetsUsd, orderDirection: Desc, where: {chainId_in: [${id}], listed: true}) {
    items { marketId chain { id } listed loanAsset { address symbol } collateralAsset { address symbol }
      state { liquidityAssetsUsd utilization supplyApy }
    }
  }
}`;

function metric(value, min, max) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function normalizeDiscoveryMarket(row, chainId, { requireListed = true } = {}) {
  const validAsset = asset => address.test(asset?.address ?? "") && typeof asset?.symbol === "string" && asset.symbol.length > 0 && asset.symbol.length <= 32;
  if (row?.chain?.id !== chainId || (requireListed && row.listed !== true) || !marketId.test(row.marketId ?? "") || !validAsset(row.loanAsset) || (row.collateralAsset != null && !validAsset(row.collateralAsset))) throw Error("Invalid Morpho market identity");
  const {state} = row, id = row.marketId.toLowerCase();
  const percent = (value, min, max) => {
    const result = metric(value, min, max);
    return result === null ? null : result * 100;
  };
  return {
    id: `eip155:${chainId}:morpho-blue:${id}`, chainId, protocol: "Morpho Blue", marketId: id, listed: row.listed === true,
    asset: {symbol: row.loanAsset.symbol, address: row.loanAsset.address.toLowerCase()},
    collateral: row.collateralAsset ? {symbol: row.collateralAsset.symbol, address: row.collateralAsset.address.toLowerCase()} : null,
    liquidityUsd: metric(state?.liquidityAssetsUsd, 0, Number.MAX_SAFE_INTEGER),
    utilizationPct: percent(state?.utilization, 0, 1), supplyApyPct: percent(state?.supplyApy, -1, Number.MAX_SAFE_INTEGER / 100)
  };
}

function optionalThreshold(value, max) {
  if (value === "") return null;
  if (typeof value !== "string" || !/^\d{1,16}(\.\d{1,8})?$/.test(value) || Number(value) > max) throw Error("Invalid risk threshold");
  return Number(value);
}

export async function discoverMorphoMarkets({ chainIds, asset = "", minLiquidityUsd = "", maxUtilizationPct = "", fetcher = globalThis.fetch, now = () => new Date(), timeoutMs = 10000 }) {
  if (!Array.isArray(chainIds) || !chainIds.length || new Set(chainIds).size !== chainIds.length || chainIds.some(id => !discoveryNetworks.some(n => n.id === id))) throw Error("Unsupported discovery networks");
  if (typeof asset !== "string" || (asset && !token.test(asset) && !address.test(asset))) throw Error("Invalid asset filter");
  const minLiquidity = optionalThreshold(minLiquidityUsd, Number.MAX_SAFE_INTEGER);
  const maxUtilization = optionalThreshold(maxUtilizationPct, 100);
  return Promise.all(chainIds.map(async chainId => {
    const network = discoveryNetworks.find(n => n.id === chainId);
    try {
      const response = await fetcher("https://api.morpho.org/graphql", {method:"POST", redirect:"error", signal:AbortSignal.timeout(timeoutMs), headers:{"Content-Type":"application/json"}, body:JSON.stringify({query:query(chainId)})});
      if (!response.ok) throw Error("Upstream HTTP failure");
      const payload = await response.json(), rows = payload.data?.markets?.items;
      if (payload.errors?.length || !Array.isArray(rows) || rows.length > discoveryLimit) throw Error("Incomplete market response");
      const normalized = rows.map(row => normalizeDiscoveryMarket(row, chainId));
      if (new Set(normalized.map(row => row.id)).size !== normalized.length) throw Error("Duplicate market identity");
      const filter = asset.toLowerCase();
      const markets = normalized.filter(row =>
        (!filter || row.asset.address === filter || row.asset.symbol.toLowerCase() === filter) &&
        (minLiquidity === null || (row.liquidityUsd !== null && row.liquidityUsd >= minLiquidity)) &&
        (maxUtilization === null || (row.utilizationPct !== null && row.utilizationPct <= maxUtilization))
      );
      return {...network, status: markets.length ? "FOUND" : "NO_MATCH", observedAt:now().toISOString(), scanned:rows.length, markets};
    } catch {
      return {...network, status:"UNAVAILABLE", observedAt:null, scanned:null, markets:[]};
    }
  }));
}
