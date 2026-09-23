import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOpportunities, loadOpportunityPreferences, normalizeOpportunityPreferences, saveOpportunityPreferences } from "../src/opportunity.js";
import { createOpportunityReceipt } from "../src/opportunity-receipt.js";
import { demoMarkets } from "../src/markets.js";
import { policyProfiles } from "../src/policy.js";
import { verifySealedDocument } from "../src/integrity.js";

test("Opportunity Agent filters and ranks markets with visible user limits", () => {
  const analysis = analyzeOpportunities(demoMarkets, policyProfiles.balanced, {
    capitalUsd: 20_000,
    minSupplyApyPct: 4,
    minLiquidityUsd: 5_000_000,
    maxUtilizationPct: 80,
    maxMarketImpactPct: 1
  });
  assert.equal(analysis.summary.total, 3);
  assert.equal(analysis.summary.eligible, 2);
  assert.equal(analysis.opportunities[0].eligible, true);
  assert.equal(analysis.opportunities.at(-1).marketName, "cirBTC Growth Market");
  assert.match(analysis.opportunities.at(-1).reason, /hard limit|liquidity|utilization/i);
});

test("Opportunity Agent caps research sizing by observed liquidity impact", () => {
  const analysis = analyzeOpportunities([demoMarkets[0]], policyProfiles.balanced, {
    capitalUsd: 1_000_000,
    minLiquidityUsd: 0,
    maxMarketImpactPct: 1
  });
  assert.equal(analysis.opportunities[0].maxResearchAmountUsd, 184_000);
  assert.match(analysis.opportunities[0].warnings[0], /capped/);
});

test("never treats a zero-liquidity market as a research candidate", () => {
  const analysis = analyzeOpportunities([{ ...demoMarkets[0], liquidityUsd: 0 }], policyProfiles.balanced, { minLiquidityUsd: 0 });
  assert.equal(analysis.summary.eligible, 0);
  assert.match(analysis.opportunities[0].reason, /No available liquidity/);
});

test("normalizes unsafe or invalid opportunity preferences", () => {
  const value = normalizeOpportunityPreferences({ capitalUsd: -5, maxUtilizationPct: 200, maxMarketImpactPct: 90 });
  assert.equal(value.capitalUsd, 1);
  assert.equal(value.maxUtilizationPct, 100);
  assert.equal(value.maxMarketImpactPct, 10);
});

test("persists Opportunity preferences in browser storage", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveOpportunityPreferences(storage, { capitalUsd: 25_000, minSupplyApyPct: 3.5 });
  const loaded = loadOpportunityPreferences(storage);
  assert.equal(loaded.capitalUsd, 25_000);
  assert.equal(loaded.minSupplyApyPct, 3.5);
});

test("creates a verifiable Opportunity receipt", () => {
  const analysis = analyzeOpportunities(demoMarkets, policyProfiles.balanced);
  const receipt = createOpportunityReceipt(analysis);
  assert.equal(receipt.schema, "cofferhouse.opportunity.receipt.v1");
  assert.equal(verifySealedDocument(receipt).valid, true);
  assert.match(receipt.receiptId, /^opportunity-/);
});
