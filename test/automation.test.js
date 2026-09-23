import test from "node:test";
import assert from "node:assert/strict";
import { createPermissionPolicy, evaluatePermissionRequest, pausePermissionPolicy, revokePermissionPolicy } from "../src/automation.js";
import { createAutomationReceipt } from "../src/automation-receipt.js";
import { verifyReceiptDocument } from "../src/receipt.js";

const watch = { schema: "cofferhouse.guardian.watch.v1", target: { id: "0x1111111111111111111111111111111111111111", name: "USDC market" }, intent: { kind: "SUPPLY_RESEARCH", amountUsd: 1000 }, sourceReceiptId: "strategy-1234567890abcdef" };
const clock = () => new Date("2026-09-23T12:00:00Z");

test("Automation creates narrow expiring simulated permissions", () => {
  const policy = createPermissionPolicy({ watch, perActionCapUsd: 250, dailyCapUsd: 500, durationMinutes: 30, now: clock });
  assert.deepEqual(policy.allowlistedTargets, [watch.target.id]);
  assert.equal(policy.perActionCapUsd, 250);
  assert.equal(policy.expiresAt, "2026-09-23T12:30:00.000Z");
});

test("Automation would allow only when every gate passes", () => {
  const policy = createPermissionPolicy({ watch, perActionCapUsd: 250, dailyCapUsd: 500, now: clock });
  const result = evaluatePermissionRequest({ policy, targetId: watch.target.id, intentKind: watch.intent.kind, amountUsd: 200, spentTodayUsd: 100, guardianDecision: "HOLD_RESEARCH", humanApprovalFresh: true, now: clock });
  assert.equal(result.decision, "WOULD_ALLOW");
  assert.equal(result.execution.attempted, false);
});

test("Automation blocks caps, changed target, pause and revocation", () => {
  const policy = createPermissionPolicy({ watch, perActionCapUsd: 250, dailyCapUsd: 500, now: clock });
  const request = { targetId: "0x2222222222222222222222222222222222222222", intentKind: watch.intent.kind, amountUsd: 400, spentTodayUsd: 300, guardianDecision: "REVIEW", humanApprovalFresh: false, now: clock };
  assert.equal(evaluatePermissionRequest({ policy, ...request }).decision, "WOULD_BLOCK");
  assert.equal(evaluatePermissionRequest({ policy: pausePermissionPolicy(policy, clock), ...request }).decision, "WOULD_BLOCK");
  assert.equal(revokePermissionPolicy(policy, clock).state, "REVOKED");
});

test("Automation receipt verifies and says policy is not installed", () => {
  const policy = createPermissionPolicy({ watch, now: clock });
  const receipt = createAutomationReceipt(policy);
  assert.equal(receipt.installed, false);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
});
