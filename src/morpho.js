const MORPHO_GRAPHQL_URL = "https://api.morpho.org/graphql";
const ARC_CHAIN_ID = 5042;

export class MarketDataSourceError extends Error {
  constructor(message, { code, retryable, status = null } = {}) {
    super(message);
    this.name = "MarketDataSourceError";
    this.provider = "Morpho API";
    this.code = code ?? "unknown";
    this.retryable = retryable ?? false;
    this.status = status;
  }
}

export const MORPHO_ARC_QUERY = `
  query ScoutArcMarkets {
    markets(
      first: 20
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [5042], listed: true }
    ) {
      items {
        marketId
        listed
        lltv
        loanAsset { address symbol decimals }
        collateralAsset { address symbol decimals }
        oracle { address }
        state {
          supplyAssetsUsd
          borrowAssetsUsd
          liquidityAssetsUsd
          utilization
          supplyApy
          borrowApy
        }
      }
    }
  }
`;

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const percentage = (value) => finite(value) === null ? null : finite(value) * 100;
const wadPercentage = (value) => {
  const numeric = finite(value);
  if (numeric === null) return null;
  return numeric > 1 ? numeric / 1e16 : numeric * 100;
};

export function normalizeMorphoMarket(item, fetchedAt = new Date()) {
  if (!item?.marketId || !item?.loanAsset?.symbol || !item?.collateralAsset?.symbol) {
    throw new Error("Morpho returned an incomplete market identity.");
  }

  const state = item.state ?? {};
  const required = [state.liquidityAssetsUsd, state.utilization, state.supplyApy, item.oracle?.address];
  const completenessPct = Math.round((required.filter((value) => value !== null && value !== undefined).length / required.length) * 100);
  const pair = `${item.loanAsset.symbol} / ${item.collateralAsset.symbol}`;
  const oracleAddress = item.oracle?.address ?? null;

  return {
    id: `morpho-${item.marketId}`,
    symbol: item.loanAsset.symbol,
    name: `${pair} Market`,
    category: item.collateralAsset.symbol === "cirBTC" ? "Crypto collateral" : "Arc credit market",
    protocol: "Morpho Blue",
    network: "Arc",
    chainId: ARC_CHAIN_ID,
    marketId: item.marketId,
    lltvPct: wadPercentage(item.lltv),
    loanAssetAddress: item.loanAsset.address ?? null,
    loanAssetDecimals: finite(item.loanAsset.decimals),
    collateralAssetAddress: item.collateralAsset.address ?? null,
    collateralAssetDecimals: finite(item.collateralAsset.decimals),
    liquidityUsd: finite(state.liquidityAssetsUsd),
    suppliedUsd: finite(state.supplyAssetsUsd),
    borrowedUsd: finite(state.borrowAssetsUsd),
    utilizationPct: percentage(state.utilization),
    apyPct: percentage(state.supplyApy),
    borrowApyPct: percentage(state.borrowApy),
    collateralVolatilityPct: null,
    oracleCount: oracleAddress ? 1 : 0,
    oracleAddress,
    contractStatus: item.listed ? "listed" : "unknown",
    ageMinutes: 0,
    completenessPct,
    source: "Morpho API · Arc mainnet",
    sourceUrl: oracleAddress ? `https://arc.etherscan.io/address/${oracleAddress}` : "https://arc.etherscan.io",
    address: item.marketId,
    observedAt: fetchedAt.toISOString(),
    note: "Live market observation. Listing is not a CofferHouse approval or recommendation.",
    dataMode: "live"
  };
}

export async function fetchMorphoArcMarkets(fetchImpl = fetch, { timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(MORPHO_GRAPHQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: MORPHO_ARC_QUERY }),
      signal: controller.signal
    });
    if (!response.ok) throw new MarketDataSourceError(`Morpho API returned HTTP ${response.status}.`, { code: "http_error", retryable: response.status >= 500 || response.status === 429, status: response.status });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new MarketDataSourceError("Morpho API returned invalid JSON.", { code: "invalid_response", retryable: true });
    }
    if (payload.errors?.length) throw new MarketDataSourceError(payload.errors[0].message || "Morpho GraphQL query failed.", { code: "graphql_error", retryable: true });
    const items = payload.data?.markets?.items;
    if (!Array.isArray(items) || items.length === 0) throw new MarketDataSourceError("No listed Morpho markets were returned for Arc.", { code: "empty_result", retryable: true });
    const fetchedAt = new Date();
    try {
      return items.map((item) => normalizeMorphoMarket(item, fetchedAt));
    } catch (error) {
      throw new MarketDataSourceError(error.message, { code: "normalization_error", retryable: false });
    }
  } catch (error) {
    if (error instanceof MarketDataSourceError) throw error;
    if (error?.name === "AbortError") throw new MarketDataSourceError("Morpho API request timed out.", { code: "timeout", retryable: true });
    throw new MarketDataSourceError("Morpho API request failed.", { code: "network_error", retryable: true });
  } finally {
    clearTimeout(timer);
  }
}
