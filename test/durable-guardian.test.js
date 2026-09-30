import test from "node:test";
import assert from "node:assert/strict";
import { demoMarkets } from "../packages/arc-data/index.js";
import { evaluateMarket, policyProfiles } from "../packages/policies/index.js";
import { createActionApproval, createActionPreview, createGuardianWatch, evaluateDurableGuardianPortfolio, evaluateDurableGuardianRegistration, guardianEvidenceFromLending } from "../packages/agent-modules/index.js";
import { verifyReceiptDocument } from "../packages/evidence/index.js";

function registrationFixture() {
  const now = () => new Date("2026-09-24T12:00:00Z");
  const market = { ...demoMarkets[0], marketId: "0x1111111111111111111111111111111111111111" };
  const preview = createActionPreview({ source: "LENDING", position: { marketId: market.marketId, marketName: market.name, amountUsd: 100, scoutStatus: "PASS" }, sourceReceiptId: "strategy-1234567890abcdef", now });
  const approval = createActionApproval({ preview, operator: "Ana", informedApproval: true, now });
  const evidence = guardianEvidenceFromLending(market, evaluateMarket(market, policyProfiles.balanced));
  const watch = createGuardianWatch({ preview, approval, evidence, now });
  return { market, registration: { schema: "cofferhouse.guardian.registration.v1", registeredAt: now().toISOString(), watch, sourceReceiptId: "guardian-1234567890abcdef", execution: { automatedAction: false, transactionAuthority: false } } };
}

test("durable Guardian evaluates a registered lending watch", () => {
  const { market, registration } = registrationFixture();
  const receipt = evaluateDurableGuardianRegistration({ registration, markets: [market], policy: policyProfiles.balanced, now: () => new Date("2026-09-24T12:05:00Z") });
  assert.equal(receipt.observation.decision, "HOLD_RESEARCH");
  assert.equal(receipt.execution.automatedAction, false);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
});

test("durable Guardian raises attention when the target disappears", () => {
  const { registration } = registrationFixture();
  const receipt = evaluateDurableGuardianRegistration({ registration, markets: [], policy: policyProfiles.balanced });
  assert.equal(receipt.observation.decision, "STOP_EXIT_RESEARCH");
  assert.equal(receipt.observation.requiresHumanAttention, true);
});

test("durable Guardian rejects unsupported registrations", () => {
  const { registration } = registrationFixture();
  assert.throws(() => evaluateDurableGuardianRegistration({ registration: { ...registration, watch: { ...registration.watch, source: "DEX_SWAP" } }, markets: [], policy: policyProfiles.balanced }), /lending/);
});

test("durable Guardian evaluates a portfolio and accepts the legacy single registration", () => {
  const { market, registration } = registrationFixture();
  const legacy = evaluateDurableGuardianPortfolio({ registrations: registration, markets: [market], policy: policyProfiles.balanced });
  const secondMarket = { ...market, marketId: "0x2222222222222222222222222222222222222222", name: "Second market" };
  const secondRegistration = { ...registration, watch: { ...registration.watch, target: { id: secondMarket.marketId, name: secondMarket.name }, baseline: { ...registration.watch.baseline, targetId: secondMarket.marketId } } };
  const portfolio = evaluateDurableGuardianPortfolio({ registrations: [registration, secondRegistration], markets: [market, secondMarket], policy: policyProfiles.balanced });
  assert.equal(legacy.length, 1);
  assert.equal(portfolio.length, 2);
  assert.deepEqual(portfolio.map((item) => item.observation.decision), ["HOLD_RESEARCH", "HOLD_RESEARCH"]);
});

test("durable Guardian portfolio rejects duplicate identities and excess watches", () => {
  const { registration } = registrationFixture();
  assert.throws(() => evaluateDurableGuardianPortfolio({ registrations: [registration, registration], markets: [], policy: policyProfiles.balanced }), /unique/);
  assert.throws(() => evaluateDurableGuardianPortfolio({ registrations: [registration, registration], markets: [], policy: policyProfiles.balanced, maxWatches: 1 }), /up to 1/);
});
