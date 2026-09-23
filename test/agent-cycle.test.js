import test from "node:test";
import assert from "node:assert/strict";
import { runAgentCycle } from "../src/agent-cycle.js";
import { demoMarkets } from "../src/markets.js";
import { policyProfiles } from "../src/policy.js";

test("server-ready agent cycle observes, evaluates, decides and records", () => {
  const cycle = runAgentCycle({
    currentMarkets: demoMarkets,
    policy: policyProfiles.balanced,
    limits: { liquidityChangePct: 5, utilizationChangePts: 2 },
    now: () => new Date("2026-09-23T13:00:00.000Z")
  });
  assert.equal(cycle.schema, "cofferhouse.scout.agent-cycle.v1");
  assert.equal(cycle.observation.marketCount, 3);
  assert.equal(cycle.decision.action, "WATCH");
  assert.equal(cycle.ranAt, "2026-09-23T13:00:00.000Z");
  assert.deepEqual(cycle.trace.map((step) => step.phase), ["OBSERVE", "EVALUATE", "COMPARE", "DECIDE"]);
  assert.equal(cycle.trace[2].status, "BASELINE");
});

test("cycle compares durable previous observations", () => {
  const current = demoMarkets.map((market, index) => index === 0 ? { ...market, liquidityUsd: market.liquidityUsd * 0.8 } : market);
  const cycle = runAgentCycle({
    currentMarkets: current,
    previousMarkets: demoMarkets,
    policy: policyProfiles.balanced,
    limits: { liquidityChangePct: 5, utilizationChangePts: 2 }
  });
  assert.ok(cycle.comparison.materialChanges >= 1);
  assert.match(cycle.comparison.changes[0].message, /liquidity|policy/i);
  assert.equal(cycle.trace[2].status, "COMPLETE");
});
