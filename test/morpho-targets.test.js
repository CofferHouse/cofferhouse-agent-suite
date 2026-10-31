import test from "node:test";
import assert from "node:assert/strict";
import { fetchMorphoArcTargets } from "../packages/arc-data/index.js";

const ids = [1, 2, 3].map(number => `0x${String(number).repeat(64)}`);
const market = (marketId = ids[0]) => ({
  marketId, chain: { id: 5042 }, listed: false, lltv: "860000000000000000",
  loanAsset: { address: `0x${"4".repeat(40)}`, symbol: "USDC", decimals: 6 },
  collateralAsset: { address: `0x${"5".repeat(40)}`, symbol: "cirBTC", decimals: 8 },
  oracle: { address: `0x${"6".repeat(40)}` },
  state: { supplyAssetsUsd: 1000000, borrowAssetsUsd: 100000, liquidityAssetsUsd: 900000, utilization: 0.1, supplyApy: 0.04, borrowApy: 0.05 }
});
const response = payload => ({ ok: true, json: async () => payload });

test("queries exact Arc targets without a listed filter or ranking cutoff", async () => {
  let request;
  const result = await fetchMorphoArcTargets([ids[0], ids[0].toUpperCase().replace("0X", "0x")], { fetcher: async (url, options) => {
    request = { url, ...options };
    return response({ data: { target0: market() } });
  } });
  const body = JSON.parse(request.body);
  assert.match(body.query, /marketById/);
  assert.match(body.query, /chainId: 5042/);
  assert.doesNotMatch(body.query, /listed: true|first: 20|orderBy/);
  assert.deepEqual(body.variables, { id0: ids[0] });
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "FOUND");
  assert.equal(result[0].market.contractStatus, "unknown");
  assert.equal(request.redirect, "error");
});

test("one alias failure does not erase a different observed target", async () => {
  const result = await fetchMorphoArcTargets(ids, { fetcher: async () => response({ data: { target0: market(), target1: null, target2: null }, errors: [{ path: ["target1"], message: "Indexer failed" }] }) });
  assert.deepEqual(result.map(item => item.status), ["FOUND", "UNAVAILABLE", "NOT_INDEXED"]);
  assert.equal(result[1].code, "GRAPHQL_ERROR");
});

test("missing aliases, wrong chain and wrong target identities never become missing-market proof", async () => {
  const wrongChain = market(ids[1]); wrongChain.chain.id = 1;
  const result = await fetchMorphoArcTargets(ids, { fetcher: async () => response({ data: { target0: market(ids[1]), target1: wrongChain } }) });
  assert.deepEqual(result.map(item => item.code), ["IDENTITY_MISMATCH", "IDENTITY_MISMATCH", "MISSING_RESPONSE"]);
  assert.ok(result.every(item => item.status === "UNAVAILABLE"));
});

test("global GraphQL failures invalidate all aliases even if data was included", async () => {
  const result = await fetchMorphoArcTargets([ids[0]], { fetcher: async () => response({ data: { target0: market() }, errors: [{ message: "Query rejected" }] }) });
  assert.equal(result[0].status, "UNAVAILABLE");
  assert.equal(result[0].code, "GRAPHQL_ERROR");
});

test("normalization failures remain isolated to the incomplete target", async () => {
  const broken = market(ids[1]); delete broken.loanAsset;
  const result = await fetchMorphoArcTargets(ids.slice(0, 2), { fetcher: async () => response({ data: { target0: market(), target1: broken } }) });
  assert.equal(result[0].status, "FOUND");
  assert.equal(result[1].code, "INCOMPLETE_TARGET");
});

test("transport failures remain unavailable rather than missing", async () => {
  const result = await fetchMorphoArcTargets([ids[0]], { fetcher: async () => ({ ok: false, status: 429 }) });
  assert.equal(result[0].status, "UNAVAILABLE");
  assert.equal(result[0].code, "HTTP_429");
});

test("timeouts produce a bounded source diagnostic", async () => {
  const result = await fetchMorphoArcTargets([ids[0]], { timeoutMs: 5, fetcher: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  assert.equal(result[0].code, "TIMEOUT");
});

test("empty and invalid targets cause no network call, and watch count is bounded", async () => {
  const fetcher = () => assert.fail("No network request expected");
  assert.deepEqual(await fetchMorphoArcTargets([], { fetcher }), []);
  assert.equal((await fetchMorphoArcTargets(["not-a-market"], { fetcher }))[0].code, "INVALID_TARGET");
  await assert.rejects(fetchMorphoArcTargets(Array(21).fill(ids[0]), { fetcher }), /20/);
});
