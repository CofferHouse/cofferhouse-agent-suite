import test from "node:test";
import assert from "node:assert/strict";
import { scanMarkets } from "../src/agent.js";
import { demoMarkets } from "../src/markets.js";
import { policy } from "../src/policy.js";
import { createScoutReceipt, createSimulationReceipt } from "../src/receipt.js";
import { simulateBorrow } from "../src/simulator.js";

test("creates a complete, deterministic Scout receipt", () => {
  const scan = scanMarkets(demoMarkets);
  const first = createScoutReceipt(scan, policy);
  const second = createScoutReceipt(scan, policy);

  assert.equal(first.schema, "cofferhouse.scout.receipt.v1");
  assert.equal(first.receiptId, second.receiptId);
  assert.equal(first.summary.total, 3);
  assert.equal(first.results.length, 3);
  assert.equal(first.policy.version, "scout-balanced-0.3");
  assert.ok(first.results.every((result) => result.status && result.reason));
});

test("creates a deterministic receipt for a read-only simulation", () => {
  const market = {
    ...demoMarkets[0],
    marketId: "0xmarket",
    suppliedUsd: 10_000_000,
    borrowedUsd: 4_000_000,
    liquidityUsd: 6_000_000,
    utilizationPct: 40
  };
  const simulation = simulateBorrow(market, 1_000_000, policy);
  const receipt = createSimulationReceipt(market, simulation, policy);

  assert.equal(receipt.schema, "cofferhouse.scout.simulation-receipt.v1");
  assert.match(receipt.receiptId, /^simulation-/);
  assert.equal(receipt.result.proposedBorrowUsd, 1_000_000);
  assert.equal(receipt.result.before.liquidityUsd, 6_000_000);
  assert.equal(receipt.result.after.liquidityUsd, 5_000_000);
  assert.equal(receipt.result.after.utilizationPct, 50);
});
