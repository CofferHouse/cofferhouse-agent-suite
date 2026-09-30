import test from "node:test";
import assert from "node:assert/strict";
import { buildMissionControl } from "../packages/agent-core/index.js";

const scan = { total: 8, counts: { PASS: 0, REVIEW: 2, REJECT: 6 }, ranked: [{ market: { dataMode: "live" } }] };
const session = { dataMode: "live", summary: { decision: "RESEARCH_READY", lendingPositions: 2, dexPositions: 0 } };

test("Mission Control asks for a coordinated session when none exists", () => {
  const result = buildMissionControl({ scan });
  assert.equal(result.status, "IDLE");
  assert.equal(result.nextAction.kind, "RUN_SESSION");
  assert.deepEqual(result.boundary, { custody: false, signature: false, execution: false });
});

test("Mission Control prioritizes Guardian human attention", () => {
  const result = buildMissionControl({ scan, session, guardianObservation: { requiresHumanAttention: true, reason: "Liquidity deteriorated." } });
  assert.equal(result.status, "ATTENTION");
  assert.equal(result.nextAction.view, "guardian");
  assert.match(result.detail, /Liquidity/);
});

test("Mission Control prioritizes durable Guardian attention after browser reload", () => {
  const result = buildMissionControl({ scan, session, durableGuardianObservation: { requiresHumanAttention: true, reasons: ["The watched market disappeared."] } });
  assert.equal(result.status, "ATTENTION");
  assert.equal(result.detail, "The watched market disappeared.");
  assert.equal(result.nextAction.view, "guardian");
});

test("Mission Control routes a pending preview to the single human gate", () => {
  const result = buildMissionControl({ scan, session, actionPreview: { status: "HUMAN_REVIEW_REQUIRED" } });
  assert.equal(result.status, "HUMAN_REVIEW");
  assert.equal(result.nextAction.view, "action");
});

test("Mission Control reports no-allocation as a valid research outcome", () => {
  const noAllocation = { dataMode: "live", summary: { decision: "NO_ELIGIBLE_ALLOCATION", lendingPositions: 0, dexPositions: 0 } };
  const result = buildMissionControl({ scan, session: noAllocation });
  assert.equal(result.status, "NO_ALLOCATION");
  assert.equal(result.nextAction.view, "opportunity");
});

test("Mission Control detects a stale unattended runtime", () => {
  const result = buildMissionControl({ scan, session, deployment: { status: "DEGRADED_STALE", ageMinutes: 61 } });
  assert.equal(result.status, "DEGRADED");
  assert.equal(result.nextAction.view, "scout");
  assert.equal(result.indicators.find((item) => item.id === "runtime").tone, "danger");
});
