import test from "node:test";
import assert from "node:assert/strict";
import { createGuardianWatch, evaluateGuardian } from "../src/guardian.js";
import { createGuardianReceipt } from "../src/guardian-receipt.js";
import { verifyReceiptDocument } from "../src/receipt.js";

const preview = { schema: "cofferhouse.action.preview.v1", source: "LENDING", sourceReceiptId: "strategy-1234567890abcdef", target: { id: "0x1111111111111111111111111111111111111111", name: "USDC market" }, intent: { kind: "SUPPLY_RESEARCH", amountUsd: 1000 } };
const approval = { schema: "cofferhouse.action.approval.v1", operator: "Ana", approvedAt: "2026-09-23T12:00:00Z", expiresAt: "2099-09-23T12:15:00Z" };
const evidence = { source: "LENDING", targetId: preview.target.id, observedAt: "2026-09-23T12:00:00Z", status: "PASS", score: 90, liquidityUsd: 100_000, utilizationPct: 40, priceChange24hPct: null, modeledImpactPct: null };

test("Guardian holds research when evidence remains inside limits", () => {
  const watch = createGuardianWatch({ preview, approval, evidence });
  const result = evaluateGuardian(watch, { ...evidence, liquidityUsd: 95_000, utilizationPct: 42 });
  assert.equal(result.decision, "HOLD_RESEARCH");
  assert.equal(result.requiresHumanAttention, false);
});

test("Guardian requests review after material deterioration", () => {
  const watch = createGuardianWatch({ preview, approval, evidence });
  const result = evaluateGuardian(watch, { ...evidence, liquidityUsd: 80_000, utilizationPct: 47 });
  assert.equal(result.decision, "REVIEW");
  assert.equal(result.requiresHumanAttention, true);
  assert.ok(result.reasons.length >= 2);
});

test("Guardian stops research when target disappears or rejects", () => {
  const watch = createGuardianWatch({ preview, approval, evidence });
  assert.equal(evaluateGuardian(watch, null).decision, "STOP_EXIT_RESEARCH");
  assert.equal(evaluateGuardian(watch, { ...evidence, status: "REJECT" }).decision, "STOP_EXIT_RESEARCH");
});

test("Guardian receipt is verifiable and claims no automated action", () => {
  const watch = createGuardianWatch({ preview, approval, evidence });
  const receipt = createGuardianReceipt(watch, evaluateGuardian(watch, evidence));
  assert.equal(receipt.execution.automatedAction, false);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
});

test("Guardian rejects an expired human approval", () => {
  assert.throws(() => createGuardianWatch({ preview, approval: { ...approval, expiresAt: "2026-09-23T12:15:00Z" }, evidence, now: () => new Date("2026-09-23T12:16:00Z") }), /expired/);
});
