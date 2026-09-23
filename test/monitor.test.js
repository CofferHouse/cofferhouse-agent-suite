import test from "node:test";
import assert from "node:assert/strict";
import { compareMarketSnapshots } from "../src/monitor.js";
import { policyProfiles } from "../src/policy.js";

const market = {
  marketId: "0xmarket",
  name: "USDC / TEST Market",
  network: "Arc",
  liquidityUsd: 10_000_000,
  utilizationPct: 50,
  contractStatus: "allowlisted",
  ageMinutes: 0,
  oracleCount: 2,
  collateralVolatilityPct: 20,
  completenessPct: 100,
  observedAt: "2026-09-23T00:00:00.000Z"
};

test("detects material liquidity and utilization changes", () => {
  const next = { ...market, liquidityUsd: 8_000_000, utilizationPct: 54, observedAt: "2026-09-23T00:05:00.000Z" };
  const result = compareMarketSnapshots([market], [next], policyProfiles.balanced);
  assert.equal(result.materialChanges, 2);
  assert.ok(result.changes.some((change) => change.type === "liquidity"));
  assert.ok(result.changes.some((change) => change.type === "utilization"));
});

test("ignores small market noise", () => {
  const next = { ...market, liquidityUsd: 9_900_000, utilizationPct: 50.5 };
  const result = compareMarketSnapshots([market], [next], policyProfiles.balanced);
  assert.equal(result.materialChanges, 0);
});

test("reports new and removed markets", () => {
  const replacement = { ...market, marketId: "0xnew", name: "New Market" };
  const result = compareMarketSnapshots([market], [replacement], policyProfiles.balanced);
  assert.deepEqual(result.changes.map((change) => change.type).sort(), ["new", "removed"]);
});
