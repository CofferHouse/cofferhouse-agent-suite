import test from "node:test";
import assert from "node:assert/strict";
import { demoMarkets } from "../packages/arc-data/index.js";
import { policyProfiles } from "../packages/policies/index.js";
import { evaluateDexPool, runResearchSession } from "../packages/agent-modules/index.js";
import { createResearchSessionReceipt, verifyReceiptDocument } from "../packages/evidence/index.js";

const fixedNow = () => "2026-09-24T12:00:00.000Z";

test("Agent Hub coordinates the lending research chain without execution authority", () => {
  const session = runResearchSession({ markets: demoMarkets, policy: policyProfiles.balanced, now: fixedNow });
  assert.equal(session.schema, "cofferhouse.agent-hub.session.v1");
  assert.equal(session.stages[0].status, "COMPLETE");
  assert.equal(session.stages.at(-1).status, "WAITING_HUMAN");
  assert.deepEqual(session.execution, { prepared: false, signed: false, submitted: false });
  assert.equal(session.summary.marketsObserved, demoMarkets.length);
});

test("Agent Hub skips DEX honestly when no pool evidence exists", () => {
  const session = runResearchSession({ markets: demoMarkets, policy: policyProfiles.balanced, now: fixedNow });
  assert.equal(session.stages.find((stage) => stage.id === "dex").status, "SKIPPED");
  assert.equal(session.outputs.dexOpportunities, null);
  assert.equal(session.summary.dexPoolsObserved, 0);
});

test("Agent Hub includes observed DEX evidence and issues a verifiable receipt", () => {
  const pool = {
    schema: "cofferhouse.dex.pool-observation.v1", chainId: 5042002, pairAddress: "0x1111111111111111111111111111111111111111",
    baseToken: { address: "0x2222222222222222222222222222222222222222", symbol: "TEST" }, quoteToken: { address: "0x3333333333333333333333333333333333333333", symbol: "USDC" },
    liquidityUsd: 2_000_000, volume24hUsd: 500_000, priceChange24hPct: 2, pairCreatedAt: "2026-01-01T00:00:00.000Z", observedAt: fixedNow(), speculativeApproval: false
  };
  const dexReports = [evaluateDexPool(pool, undefined, 1_000)];
  const session = runResearchSession({ markets: demoMarkets, policy: policyProfiles.balanced, dexReports, now: fixedNow });
  assert.equal(session.stages.find((stage) => stage.id === "dex").status, "COMPLETE");
  assert.equal(session.summary.dexPoolsObserved, 1);
  const receipt = createResearchSessionReceipt(session);
  assert.equal(receipt.schema, "cofferhouse.agent-hub.session-receipt.v1");
  assert.equal(verifyReceiptDocument(receipt).valid, true);
});
