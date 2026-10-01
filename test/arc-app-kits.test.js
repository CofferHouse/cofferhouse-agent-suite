import test from "node:test";
import assert from "node:assert/strict";
import { analyzeEarnOpportunities, arcAppKitCatalog, buildEarnStrategy, fetchArcEarnVaults, loadEarnOpportunityPreferences, normalizeEarnVaultResponse, saveEarnOpportunityPreferences } from "../packages/agent-modules/index.js";
import { createEarnOpportunityReceipt, createEarnStrategyReceipt, verifyReceiptDocument } from "../packages/evidence/index.js";

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

test("Earn opportunity research preserves low-liquidity blockers", () => {
  const data = normalizeEarnVaultResponse({ vaults: [
    { vaultAddress: "0x1111111111111111111111111111111111111111", name: "Deep USDC", protocol: "MORPHO", asset: "USDC", currentApy: 0.04, liquidity: "500000", totalDeposits: "1000000", status: "active" },
    { vaultAddress: "0x2222222222222222222222222222222222222222", name: "Thin USDC", protocol: "MORPHO", asset: "USDC", currentApy: 0.09, liquidity: "500", totalDeposits: "100000", status: "low_liquidity" }
  ] });
  const analysis = analyzeEarnOpportunities(data.vaults, { minApyPct: 1, minAvailableLiquidityUsd: 10_000, minTotalDepositsUsd: 50_000 });
  assert.equal(analysis.summary.eligible, 1);
  assert.equal(analysis.opportunities[0].name, "Deep USDC");
  assert.match(analysis.opportunities[1].reason, /liquidity/i);
});

test("Earn preferences persist and receipts detect supported evidence", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveEarnOpportunityPreferences(storage, { asset: "EURC", minApyPct: 3.5, includeLowLiquidity: true });
  assert.equal(loadEarnOpportunityPreferences(storage).asset, "EURC");
  const data = normalizeEarnVaultResponse({ vaults: [{ vaultAddress: "0x1111111111111111111111111111111111111111", name: "EURC", protocol: "MORPHO", asset: "EURC", currentApy: 0.04, liquidity: "500000", totalDeposits: "1000000", status: "active" }] });
  const receipt = createEarnOpportunityReceipt(analyzeEarnOpportunities(data.vaults, { asset: "EURC", minApyPct: 3.5 }));
  assert.equal(verifyReceiptDocument(receipt).valid, true);
  assert.match(receipt.receiptId, /^earn-opportunity-/);
});

test("Strategy Lab allocates eligible Earn vaults without merging evidence types", () => {
  const data = normalizeEarnVaultResponse({ vaults: [
    { vaultAddress: "0x1111111111111111111111111111111111111111", name: "USDC Alpha", protocol: "MORPHO", asset: "USDC", currentApy: 0.05, liquidity: "1000000", totalDeposits: "2000000", status: "active" },
    { vaultAddress: "0x2222222222222222222222222222222222222222", name: "EURC Beta", protocol: "MORPHO", asset: "EURC", currentApy: 0.04, liquidity: "800000", totalDeposits: "1000000", status: "active" }
  ] });
  const analysis = analyzeEarnOpportunities(data.vaults, { capitalUsd: 10_000, minApyPct: 1, maxLiquiditySharePct: 1 });
  const proposal = buildEarnStrategy(analysis, { capitalUsd: 10_000, reservePct: 20, maxMarkets: 2, maxPerMarketPct: 50, minResearchScore: 0 });
  assert.equal(proposal.schema, "cofferhouse.arc-app-kits.earn-strategy.v1");
  assert.equal(proposal.summary.allocatedUsd, 8000);
  assert.equal(proposal.positions.every((position) => position.sourceType === "ARC_EARN_VAULT"), true);
  assert.match(proposal.separationRule, /separate/i);
  assert.equal(verifyReceiptDocument(createEarnStrategyReceipt(proposal)).valid, true);
});
