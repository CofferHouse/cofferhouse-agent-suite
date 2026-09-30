import test from "node:test";
import assert from "node:assert/strict";
import { createActionApproval, createActionPreview, createGuardianWatch, createPermissionPolicy, evaluateGuardian, evaluatePermissionRequest, isActionApprovalFresh } from "../packages/agent-modules/index.js";
import { clearOperatorWorkspace, loadOperatorWorkspace, saveOperatorWorkspace } from "../packages/evidence/index.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values
  };
}

function fixture() {
  const now = () => new Date("2026-09-24T12:00:00Z");
  const position = { marketId: "0x1111111111111111111111111111111111111111", marketName: "USDC market", amountUsd: 1_000, scoutStatus: "PASS" };
  const actionPreview = createActionPreview({ source: "LENDING", position, sourceReceiptId: "strategy-1234567890abcdef", now });
  const actionApproval = createActionApproval({ preview: actionPreview, operator: "Ana", informedApproval: true, now });
  const evidence = { source: "LENDING", targetId: position.marketId, observedAt: now().toISOString(), status: "PASS", score: 90, liquidityUsd: 100_000, utilizationPct: 40, priceChange24hPct: null, modeledImpactPct: null };
  const guardianWatch = createGuardianWatch({ preview: actionPreview, approval: actionApproval, evidence, now });
  const guardianObservation = evaluateGuardian(guardianWatch, evidence, now);
  const automationPolicy = createPermissionPolicy({ watch: guardianWatch, perActionCapUsd: 250, dailyCapUsd: 500, now });
  const automationEvaluation = evaluatePermissionRequest({ policy: automationPolicy, targetId: position.marketId, intentKind: actionPreview.intent.kind, amountUsd: 100, spentTodayUsd: 0, guardianDecision: guardianObservation.decision, humanApprovalFresh: true, now });
  return { actionPreview, actionApproval, guardianWatch, guardianObservation, automationPolicy, automationEvaluation };
}

test("operator workspace restores a sealed non-executable chain", () => {
  const storage = memoryStorage();
  assert.equal(saveOperatorWorkspace(storage, fixture()), true);
  const restored = loadOperatorWorkspace(storage);
  assert.equal(restored.guardianObservation.decision, "HOLD_RESEARCH");
  assert.equal(restored.automationEvaluation.execution.attempted, false);
});

test("operator workspace rejects altered stored state", () => {
  const storage = memoryStorage();
  saveOperatorWorkspace(storage, fixture());
  const [key, raw] = [...storage.values.entries()][0];
  const altered = JSON.parse(raw);
  altered.actionPreview.intent.amountUsd = 9_999;
  storage.setItem(key, JSON.stringify(altered));
  assert.equal(loadOperatorWorkspace(storage), null);
});

test("operator workspace rejects mismatched downstream identity", () => {
  const storage = memoryStorage();
  const state = fixture();
  state.guardianWatch = { ...state.guardianWatch, target: { ...state.guardianWatch.target, id: "0x2222222222222222222222222222222222222222" } };
  assert.equal(saveOperatorWorkspace(storage, state), false);
  assert.equal(loadOperatorWorkspace(storage), null);
});

test("approval freshness expires independently from restored evidence", () => {
  const { actionApproval } = fixture();
  assert.equal(isActionApprovalFresh(actionApproval, () => new Date("2026-09-24T12:14:59Z")), true);
  assert.equal(isActionApprovalFresh(actionApproval, () => new Date("2026-09-24T12:15:01Z")), false);
});

test("operator workspace can be cleared", () => {
  const storage = memoryStorage();
  saveOperatorWorkspace(storage, fixture());
  clearOperatorWorkspace(storage);
  assert.equal(loadOperatorWorkspace(storage), null);
});
