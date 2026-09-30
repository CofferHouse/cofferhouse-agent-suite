import test from "node:test";
import assert from "node:assert/strict";
import { finiteNumberOrNull, isArcChain, isEvmAddress, normalizeEvmAddress, validateMarketObservation } from "../packages/market-schema/index.js";
test("normalizes shared numeric and address primitives", () => {
  assert.equal(finiteNumberOrNull("12.5"), 12.5); assert.equal(finiteNumberOrNull(""), null);
  assert.equal(isEvmAddress("0x1111111111111111111111111111111111111111"), true);
  assert.equal(normalizeEvmAddress("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
});
test("recognizes Arc consistently across provider formats", () => {
  assert.equal(isArcChain(5042), true); assert.equal(isArcChain("5042"), true); assert.equal(isArcChain("arc"), true); assert.equal(isArcChain("ethereum"), false);
});
test("rejects malformed normalized market observations", () => {
  const result = validateMarketObservation({ id: "bad", marketId: "x", protocol: "Test", network: "Arc", liquidityUsd: -1, utilizationPct: 101, apyPct: Infinity });
  assert.equal(result.valid, false); assert.equal(result.errors.length, 3);
});
