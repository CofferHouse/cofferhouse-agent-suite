import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMarket, policyProfiles } from "../src/policy.js";
import { demoMarkets } from "../src/markets.js";

test("publishes three versioned policy profiles", () => {
  assert.deepEqual(Object.keys(policyProfiles), ["preservation", "balanced", "yield"]);
  assert.ok(Object.values(policyProfiles).every((profile) => profile.version && profile.name));
});

test("preservation is stricter than yield discovery", () => {
  const market = { ...demoMarkets[0], liquidityUsd: 1_500_000, utilizationPct: 87 };
  const preservation = evaluateMarket(market, policyProfiles.preservation);
  const yieldDiscovery = evaluateMarket(market, policyProfiles.yield);

  assert.equal(preservation.status, "REJECT");
  assert.notEqual(yieldDiscovery.status, "REJECT");
});

test("yield profile does not bypass contract verification", () => {
  const market = { ...demoMarkets[0], contractStatus: "listed" };
  const report = evaluateMarket(market, policyProfiles.yield);
  assert.equal(report.status, "REVIEW");
  assert.ok(report.warnings.some((warning) => warning.id === "contract"));
});
