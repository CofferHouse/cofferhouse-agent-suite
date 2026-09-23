import test from "node:test";
import assert from "node:assert/strict";
import { markets } from "../src/markets.js";
import { evaluateMarket } from "../src/policy.js";

test("USDC baseline passes every policy", () => {
  const report = evaluateMarket(markets[0]);
  assert.equal(report.status, "PASS");
  assert.equal(report.score, 100);
  assert.equal(report.warnings.length, 0);
});

test("RWA case is routed to human review", () => {
  const report = evaluateMarket(markets[1]);
  assert.equal(report.status, "REVIEW");
  assert.ok(report.warnings.some((item) => item.id === "contract"));
  assert.ok(report.warnings.some((item) => item.id === "oracles"));
});

test("cirBTC high utilization triggers a hard rejection", () => {
  const report = evaluateMarket(markets[2]);
  assert.equal(report.status, "REJECT");
  assert.ok(report.rules.some((item) => item.id === "utilization" && item.outcome === "reject"));
});

test("same inputs always produce the same report", () => {
  assert.deepEqual(evaluateMarket(markets[1]), evaluateMarket(markets[1]));
});
