import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDexPool, loadDexWatchlist, normalizeDexPair, normalizeDexWatchlist, saveDexWatchlist } from "../src/dex-pools.js";
import { normalizeDexScreenerResponse } from "../src/dex-provider.js";
import { createDexReceipt } from "../src/dex-receipt.js";
import { verifySealedDocument } from "../src/integrity.js";

const address = "0x1111111111111111111111111111111111111111";
const pairAddress = "0x2222222222222222222222222222222222222222";
const pair = { chainId: "arc", dexId: "uniswap", pairAddress, baseToken: { address, name: "Meme", symbol: "MEME" }, quoteToken: { address: "0x3600000000000000000000000000000000000000", name: "USD Coin", symbol: "USDC" }, priceUsd: "0.01", liquidity: { usd: 100_000 }, volume: { h24: 50_000 }, txns: { h24: { buys: 100, sells: 90 } }, priceChange: { h24: 12 }, pairCreatedAt: Date.now() - 48 * 3_600_000 };

test("DEX watchlist accepts unique contracts and preserves speculative approval", () => {
  const list = normalizeDexWatchlist([{ address, label: "MEME", speculativeApproval: true }, { address: address.toUpperCase() }, { address: "bad" }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].speculativeApproval, true);
});

test("DEX watchlist persists in browser storage", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveDexWatchlist(storage, [{ address, label: "MEME" }]);
  assert.equal(loadDexWatchlist(storage)[0].address, address);
});

test("DEX provider keeps only Arc pools and ranks liquidity", () => {
  const pools = normalizeDexScreenerResponse({ pairs: [pair, { ...pair, chainId: "ethereum", pairAddress: "0x3333333333333333333333333333333333333333" }, { ...pair, pairAddress: "0x4444444444444444444444444444444444444444", liquidity: { usd: 200_000 } }] });
  assert.equal(pools.length, 2);
  assert.equal(pools[0].liquidityUsd, 200_000);
});

test("DEX evaluation preserves user-approved risk without overriding warnings", () => {
  const pool = normalizeDexPair(pair, { speculativeApproval: true });
  const report = evaluateDexPool(pool, undefined, 1_000);
  assert.equal(report.label, "USER-APPROVED SPECULATIVE");
  assert.equal(report.status, "REVIEW");
  assert.match(report.firstAttention, /independent verification/);
});

test("DEX evaluation rejects a modeled swap that is too large for liquidity", () => {
  const pool = normalizeDexPair({ ...pair, liquidity: { usd: 10_000 } });
  const report = evaluateDexPool(pool, undefined, 2_000);
  assert.equal(report.status, "REJECT");
  assert.ok(report.checks.some((check) => check.id === "modeledImpact" && check.outcome === "reject"));
});

test("creates a verifiable DEX pool receipt", () => {
  const pool = normalizeDexPair(pair, { address, speculativeApproval: true });
  const receipt = createDexReceipt([evaluateDexPool(pool)], [{ address, speculativeApproval: true }], 1_000);
  assert.equal(receipt.schema, "cofferhouse.dex.pool-receipt.v1");
  assert.equal(verifySealedDocument(receipt).valid, true);
});
