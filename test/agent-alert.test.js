import test from "node:test";
import assert from "node:assert/strict";
import { createAgentAlert, createGuardianAlert } from "../packages/agent-core/index.js";

const cycle = {
  ranAt: "2026-09-23T13:00:00.000Z",
  policy: { version: "scout-balanced-0.3" },
  decision: { action: "ESCALATE", reason: "Policy changed to REJECT." },
  comparison: { changes: [{ marketId: "0x1", market: "USDC / TEST", level: "reject", type: "status", message: "Policy changed to REJECT." }] }
};

test("creates deterministic deduplicatable alerts for material decisions", () => {
  const first = createAgentAlert(cycle);
  const second = createAgentAlert({ ...cycle, ranAt: "2026-09-23T13:05:00.000Z" });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.severity, "ESCALATE");
  assert.equal(first.changes.length, 1);
});

test("does not alert for watch-only cycles", () => {
  assert.equal(createAgentAlert({ ...cycle, decision: { action: "WATCH", reason: "Existing rejection." } }), null);
});

test("creates a deduplicatable Guardian alert only for human attention", () => {
  const receipt = { schema: "cofferhouse.guardian.receipt.v1", observation: { observedAt: "2026-09-24T12:00:00Z", target: { id: "0x1111111111111111111111111111111111111111", name: "USDC market" }, decision: "REVIEW", reasons: ["Liquidity deteriorated."], requiresHumanAttention: true } };
  const alert = createGuardianAlert(receipt);
  assert.equal(alert.severity, "REVIEW");
  assert.equal(alert.fingerprint, createGuardianAlert({ ...receipt, observation: { ...receipt.observation, observedAt: "2026-09-24T12:05:00Z" } }).fingerprint);
  assert.equal(createGuardianAlert({ ...receipt, observation: { ...receipt.observation, requiresHumanAttention: false } }), null);
});
