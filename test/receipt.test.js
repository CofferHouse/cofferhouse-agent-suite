import test from "node:test";
import assert from "node:assert/strict";
import { scanMarkets } from "../src/agent.js";
import { demoMarkets } from "../src/markets.js";
import { policy } from "../src/policy.js";
import { createScoutReceipt, createSimulationReceipt, verifyReceiptDocument } from "../src/receipt.js";
import { simulateBorrow } from "../src/simulator.js";
import { verifySealedDocument } from "../src/integrity.js";

test("creates a complete, deterministic Scout receipt", () => {
  const scan = scanMarkets(demoMarkets);
  const first = createScoutReceipt(scan, policy);
  const second = createScoutReceipt(scan, policy);

  assert.equal(first.schema, "cofferhouse.scout.receipt.v2");
  assert.equal(first.receiptId, second.receiptId);
  assert.equal(first.summary.total, 3);
  assert.equal(first.results.length, 3);
  assert.equal(first.policy.version, "scout-balanced-0.3");
  assert.ok(first.results.every((result) => result.status && result.reason));
  assert.equal(verifySealedDocument(first).valid, true);
  assert.match(first.integrity.contentHash, /^[a-f0-9]{64}$/);
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

  assert.equal(receipt.schema, "cofferhouse.scout.simulation-receipt.v2");
  assert.match(receipt.receiptId, /^simulation-/);
  assert.equal(receipt.result.proposedBorrowUsd, 1_000_000);
  assert.equal(receipt.result.before.liquidityUsd, 6_000_000);
  assert.equal(receipt.result.after.liquidityUsd, 5_000_000);
  assert.equal(receipt.result.after.utilizationPct, 50);
  assert.equal(verifySealedDocument(receipt).valid, true);
});

test("detects any modification to a sealed receipt", () => {
  const receipt = createScoutReceipt(scanMarkets(demoMarkets), policy);
  const altered = structuredClone(receipt);
  altered.results[0].score += 1;
  const verification = verifySealedDocument(altered);
  assert.equal(verification.valid, false);
  assert.match(verification.reason, /altered/);
});

test("accepts only recognized CofferHouse receipt schemas", () => {
  const receipt = createScoutReceipt(scanMarkets(demoMarkets), policy);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
  assert.deepEqual(verifyReceiptDocument({ ...receipt, schema: "unrelated.document.v1" }), {
    valid: false,
    reason: "Unsupported or missing CofferHouse receipt schema."
  });
});
