import test from "node:test";
import assert from "node:assert/strict";
import { simulateBorrow, suggestedBorrowAmount } from "../src/simulator.js";
import { policyProfiles } from "../src/policy.js";

const market = {
  network: "Arc",
  liquidityUsd: 6_000_000,
  suppliedUsd: 10_000_000,
  borrowedUsd: 4_000_000,
  utilizationPct: 40,
  contractStatus: "allowlisted",
  ageMinutes: 0,
  oracleCount: 2,
  collateralVolatilityPct: 20,
  completenessPct: 100
};

test("simulates borrow impact without mutating the source market", () => {
  const result = simulateBorrow(market, 1_000_000, policyProfiles.balanced);
  assert.equal(result.ok, true);
  assert.equal(result.after.liquidityUsd, 5_000_000);
  assert.equal(result.after.utilizationPct, 50);
  assert.equal(market.liquidityUsd, 6_000_000);
});

test("rejects a simulation above available liquidity", () => {
  const result = simulateBorrow(market, 6_000_001, policyProfiles.balanced);
  assert.equal(result.ok, false);
  assert.match(result.error, /exceeds currently available liquidity/i);
});

test("fails safely when live accounting inputs are missing", () => {
  const result = simulateBorrow({ ...market, suppliedUsd: null }, 1000, policyProfiles.balanced);
  assert.equal(result.ok, false);
  assert.match(result.error, /enough live data/i);
});

test("suggests a valid amount for all eight live liquidity ranges", () => {
  const liquidities = [63116937.94, 988809.02, 15838.89, 1.199829, 0.638916, 22000.05, 20430.0, 0.1143];
  for (const liquidityUsd of liquidities) {
    const amount = suggestedBorrowAmount({ liquidityUsd });
    assert.ok(amount > 0);
    assert.ok(amount <= liquidityUsd);
    assert.ok(amount <= 100000);
  }
});
