import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDexOpportunities, loadDexOpportunityPreferences, saveDexOpportunityPreferences } from "../src/dex-opportunity.js";
import { buildDexStrategy, impermanentLossReference, loadDexStrategyPreferences, saveDexStrategyPreferences } from "../src/dex-strategy.js";
import { createDexOpportunityReceipt, createDexStrategyReceipt } from "../src/dex-research-receipt.js";
import { verifyReceiptDocument } from "../src/receipt.js";

const report = { status: "REVIEW", score: 76, modeledLiquidityImpactPct: 0.5, pool: { pairAddress: "0x2222222222222222222222222222222222222222", baseToken: { address: "0x1111111111111111111111111111111111111111", symbol: "MEME" }, quoteToken: { symbol: "USDC" }, liquidityUsd: 200_000, volume24hUsd: 100_000, priceChange24hPct: 10, speculativeApproval: true }, checks: [{ outcome: "review", detail: "Token evidence requires review." }] };

test("DEX Opportunity can retain review candidates without erasing warnings", () => {
  const analysis = analyzeDexOpportunities([report], { includeReview: true });
  assert.equal(analysis.summary.eligible, 1);
  assert.equal(analysis.candidates[0].speculativeApproval, true);
  assert.equal(analysis.candidates[0].warnings.length, 1);
});

test("DEX Opportunity blocks a pool outside user limits", () => {
  const analysis = analyzeDexOpportunities([report], { minLiquidityUsd: 1_000_000 });
  assert.equal(analysis.summary.eligible, 0);
  assert.match(analysis.candidates[0].reason, /liquidity/);
});

test("DEX Strategy builds bounded swap allocation", () => {
  const analysis = analyzeDexOpportunities([report]);
  const proposal = buildDexStrategy(analysis, { capitalUsd: 10_000, reservePct: 20, maxPerPoolPct: 50, mode: "SWAP" });
  assert.equal(proposal.status, "PROPOSAL_READY");
  assert.equal(proposal.summary.reserveUsd, 2_000);
  assert.ok(proposal.positions[0].amountUsd <= 2_000);
});

test("LP strategy discloses reference impermanent loss without inventing yield", () => {
  const proposal = buildDexStrategy(analyzeDexOpportunities([report]), { mode: "LP" });
  assert.ok(proposal.impermanentLossReferencePct.priceUp100Pct < 0);
  assert.match(proposal.notice, /excludes fees/);
  assert.equal(Math.round(impermanentLossReference(2) * 100) / 100, -5.72);
});

test("DEX research preferences persist and normalize", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveDexOpportunityPreferences(storage, { minPoolScore: 62, includeReview: false });
  saveDexStrategyPreferences(storage, { capitalUsd: 12_000, mode: "LP" });
  assert.equal(loadDexOpportunityPreferences(storage).minPoolScore, 62);
  assert.equal(loadDexOpportunityPreferences(storage).includeReview, false);
  assert.equal(loadDexStrategyPreferences(storage).capitalUsd, 12_000);
  assert.equal(loadDexStrategyPreferences(storage).mode, "LP");
});

test("DEX Opportunity and Strategy receipts verify and detect alteration", () => {
  const analysis = analyzeDexOpportunities([report]);
  const opportunityReceipt = createDexOpportunityReceipt(analysis);
  const strategyReceipt = createDexStrategyReceipt(buildDexStrategy(analysis));
  assert.equal(verifyReceiptDocument(opportunityReceipt).valid, true);
  assert.equal(verifyReceiptDocument(strategyReceipt).valid, true);
  strategyReceipt.summary.allocatedUsd += 1;
  assert.equal(verifyReceiptDocument(strategyReceipt).valid, false);
});
