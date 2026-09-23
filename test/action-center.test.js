import test from "node:test";
import assert from "node:assert/strict";
import { createActionApproval, createActionPreview } from "../src/action-center.js";
import { createActionReceipt } from "../src/action-receipt.js";
import { verifyReceiptDocument } from "../src/receipt.js";

const lendingPosition = { marketId: "0x1111111111111111111111111111111111111111", marketName: "USDC / RWA", amountUsd: 1_000, scoutStatus: "REVIEW" };

test("Action Center creates a non-executable lending preview", () => {
  const preview = createActionPreview({ source: "LENDING", position: lendingPosition, sourceReceiptId: "strategy-1234567890abcdef", now: () => new Date("2026-09-23T12:00:00Z") });
  assert.equal(preview.status, "HUMAN_REVIEW_REQUIRED");
  assert.equal(preview.intent.kind, "SUPPLY_RESEARCH");
  assert.ok(preview.missingBeforeExecution.includes("Explicit wallet signature"));
  assert.equal("calldata" in preview, false);
});

test("Action Center accepts a Morpho bytes32 market id", () => {
  const position = { ...lendingPosition, marketId: `0x${"ab".repeat(32)}` };
  const preview = createActionPreview({ source: "LENDING", position, sourceReceiptId: "strategy-1234567890abcdef" });
  assert.notEqual(preview.status, "BLOCKED");
});

test("Action Center blocks an invalid target", () => {
  const preview = createActionPreview({ source: "LENDING", position: { ...lendingPosition, marketId: "bad" }, sourceReceiptId: "strategy-1234567890abcdef" });
  assert.equal(preview.status, "BLOCKED");
  assert.throws(() => createActionApproval({ preview, operator: "Ana", informedApproval: true }), /blocked/);
});

test("human approval requires one informed confirmation and expires", () => {
  const preview = createActionPreview({ source: "LENDING", position: lendingPosition, sourceReceiptId: "strategy-1234567890abcdef" });
  assert.throws(() => createActionApproval({ preview, operator: "Ana" }), /approval/);
  const now = () => new Date("2026-09-23T14:00:00Z");
  const approval = createActionApproval({ preview, operator: "Ana", informedApproval: true, now });
  assert.equal(approval.decision, "APPROVED_FOR_MANUAL_PREPARATION_ONLY");
  assert.equal(approval.expiresAt, "2026-09-23T14:15:00.000Z");
});

test("Action receipt proves that nothing was prepared or submitted", () => {
  const preview = createActionPreview({ source: "LENDING", position: lendingPosition, sourceReceiptId: "strategy-1234567890abcdef" });
  const receipt = createActionReceipt(preview);
  assert.equal(receipt.execution.submitted, false);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
});
