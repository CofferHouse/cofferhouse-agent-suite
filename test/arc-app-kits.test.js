import test from "node:test";
import assert from "node:assert/strict";
import { arcAppKitCatalog, fetchArcEarnVaults, normalizeEarnVaultResponse } from "../packages/agent-modules/index.js";

test("Arc App Kit catalog preserves the three product boundaries", () => {
  assert.deepEqual(arcAppKitCatalog.map((kit) => kit.id), ["earn", "onramp", "borrow"]);
  assert.equal(arcAppKitCatalog.find((kit) => kit.id === "onramp").ownerView, "holder");
  assert.match(arcAppKitCatalog.find((kit) => kit.id === "borrow").boundary, /human approval/i);
});

test("Earn Kit vault responses are normalized for research", () => {
  const result = normalizeEarnVaultResponse({ observedAt: "2026-10-01T00:00:00.000Z", vaults: [{ vaultAddress: "0xabc", name: "USDC Vault", protocol: "MORPHO", asset: "USDC", currentApy: 0.0525, liquidity: "1000.50", totalDeposits: "2000", status: "low_liquidity" }] });
  assert.equal(result.vaults[0].apyPct, 5.25);
  assert.equal(result.vaults[0].availableLiquidityUsd, 1000.5);
  assert.equal(result.summary.lowLiquidity, 1);
});

test("Earn Kit browser adapter uses the protected server route", async () => {
  const result = await fetchArcEarnVaults(async () => ({ ok: true, json: async () => ({ vaults: [] }) }));
  assert.equal(result.source, "Circle Arc Earn Kit");
  assert.equal(result.summary.total, 0);
});
