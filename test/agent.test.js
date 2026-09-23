import test from "node:test";
import assert from "node:assert/strict";
import { scanMarkets } from "../src/agent.js";
import { demoMarkets } from "../src/markets.js";

test("Scout Agent ranks pass before review and reject", () => {
  const scan = scanMarkets(demoMarkets);
  assert.deepEqual(scan.ranked.map((item) => item.report.status), ["PASS", "REVIEW", "REJECT"]);
  assert.deepEqual(scan.counts, { PASS: 1, REVIEW: 1, REJECT: 1 });
  assert.equal(scan.actionable, 1);
});

test("Scout Agent exposes the first bounded-policy reason", () => {
  const scan = scanMarkets(demoMarkets);
  const review = scan.ranked.find((item) => item.report.status === "REVIEW");
  assert.match(review.reason, /verification|source/i);
});
