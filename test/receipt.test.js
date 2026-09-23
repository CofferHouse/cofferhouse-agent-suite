import test from "node:test";
import assert from "node:assert/strict";
import { scanMarkets } from "../src/agent.js";
import { demoMarkets } from "../src/markets.js";
import { policy } from "../src/policy.js";
import { createScoutReceipt } from "../src/receipt.js";

test("creates a complete, deterministic Scout receipt", () => {
  const scan = scanMarkets(demoMarkets);
  const first = createScoutReceipt(scan, policy);
  const second = createScoutReceipt(scan, policy);

  assert.equal(first.schema, "cofferhouse.scout.receipt.v1");
  assert.equal(first.receiptId, second.receiptId);
  assert.equal(first.summary.total, 3);
  assert.equal(first.results.length, 3);
  assert.equal(first.policy.version, "scout-live-0.2");
  assert.ok(first.results.every((result) => result.status && result.reason));
});
