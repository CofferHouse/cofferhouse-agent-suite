import test from "node:test";
import assert from "node:assert/strict";
import { fetchMorphoArcMarkets, MarketDataSourceError, normalizeMorphoMarket } from "../src/morpho.js";

const apiMarket = {
  marketId: "0xmarket",
  listed: true,
  lltv: "860000000000000000",
  loanAsset: { address: "0xloan", symbol: "USDC", decimals: 6 },
  collateralAsset: { address: "0xcollateral", symbol: "cirBTC", decimals: 8 },
  oracle: { address: "0xoracle" },
  state: {
    supplyAssetsUsd: 100_000_000,
    borrowAssetsUsd: 37_000_000,
    liquidityAssetsUsd: 63_000_000,
    utilization: 0.37,
    supplyApy: 0.025,
    borrowApy: 0.05
  }
};

test("normalizes Morpho decimals into Scout percentages", () => {
  const market = normalizeMorphoMarket(apiMarket, new Date("2026-09-23T00:00:00.000Z"));
  assert.equal(market.name, "USDC / cirBTC Market");
  assert.equal(market.utilizationPct, 37);
  assert.equal(market.apyPct, 2.5);
  assert.equal(market.liquidityUsd, 63_000_000);
  assert.equal(market.lltvPct, 86);
  assert.equal(market.borrowApyPct, 5);
  assert.equal(market.loanAssetAddress, "0xloan");
  assert.equal(market.collateralAssetAddress, "0xcollateral");
  assert.equal(market.oracleAddress, "0xoracle");
  assert.equal(market.dataMode, "live");
});

test("requests only listed Arc markets", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: { markets: { items: [apiMarket] } } }) };
  };
  const result = await fetchMorphoArcMarkets(fakeFetch);
  assert.equal(result.length, 1);
  assert.match(request.options.body, /5042/);
  assert.match(request.options.body, /listed: true/);
});

test("fails safely when the API returns no Arc markets", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: { markets: { items: [] } } }) });
  await assert.rejects(() => fetchMorphoArcMarkets(fakeFetch), /No listed Morpho markets/);
});

test("classifies provider HTTP failures for agent diagnostics", async () => {
  const fakeFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchMorphoArcMarkets(fakeFetch), (error) => {
    assert.ok(error instanceof MarketDataSourceError);
    assert.equal(error.provider, "Morpho API");
    assert.equal(error.code, "http_error");
    assert.equal(error.retryable, true);
    assert.equal(error.status, 503);
    return true;
  });
});

test("classifies a provider timeout as retryable", async () => {
  const fakeFetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  await assert.rejects(() => fetchMorphoArcMarkets(fakeFetch, { timeoutMs: 5 }), (error) => {
    assert.equal(error.code, "timeout");
    assert.equal(error.retryable, true);
    return true;
  });
});
