import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOpportunities } from "../src/opportunity.js";
import { demoMarkets } from "../src/markets.js";
import { policyProfiles } from "../src/policy.js";
import { buildStrategy, normalizeStrategyPreferences, saveStrategyPreferences, loadStrategyPreferences } from "../src/strategy.js";
import { createStrategyReceipt } from "../src/strategy-receipt.js";
import { verifySealedDocument } from "../src/integrity.js";

const opportunities = analyzeOpportunities(demoMarkets, policyProfiles.balanced, { minLiquidityUsd: 0, maxUtilizationPct: 100 });

test("Strategy Lab creates a bounded diversified proposal", () => {
  const strategy = buildStrategy(opportunities, { capitalUsd: 20_000, reservePct: 10, maxMarkets: 2, maxPerMarketPct: 60, minResearchScore: 0 });
  assert.equal(strategy.status, "PROPOSAL_READY");
  assert.ok(strategy.positions.length <= 2);
  assert.equal(strategy.summary.reserveUsd, 2_000);
  assert.ok(strategy.summary.allocatedUsd <= 18_000);
  assert.ok(strategy.positions.every((position) => position.amountUsd <= 12_000));
  assert.ok(strategy.positions.every((position) => position.exitConditions.length === 3));
});

test("Strategy Lab does not allocate blocked markets", () => {
  const strategy = buildStrategy(opportunities, { minResearchScore: 0, maxMarkets: 8 });
  const blockedIds = new Set(opportunities.opportunities.filter((item) => !item.eligible).map((item) => item.marketId));
  assert.ok(strategy.positions.every((position) => !blockedIds.has(position.marketId)));
});

test("Strategy Lab safely returns no allocation when no candidate clears", () => {
  const strategy = buildStrategy(opportunities, { minResearchScore: 100 });
  assert.equal(strategy.status, "NO_ELIGIBLE_ALLOCATION");
  assert.equal(strategy.summary.allocatedUsd, 0);
});

test("normalizes and persists Strategy preferences", () => {
  const normalized = normalizeStrategyPreferences({ reservePct: 200, maxMarkets: 20, maxPerMarketPct: 1 });
  assert.equal(normalized.reservePct, 90);
  assert.equal(normalized.maxMarkets, 8);
  assert.equal(normalized.maxPerMarketPct, 5);
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveStrategyPreferences(storage, { capitalUsd: 25_000, reservePct: 20 });
  assert.equal(loadStrategyPreferences(storage).capitalUsd, 25_000);
});

test("creates a verifiable Strategy receipt", () => {
  const receipt = createStrategyReceipt(buildStrategy(opportunities, { minResearchScore: 0 }));
  assert.equal(receipt.schema, "cofferhouse.strategy.receipt.v1");
  assert.equal(verifySealedDocument(receipt).valid, true);
});
