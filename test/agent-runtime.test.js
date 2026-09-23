import test from "node:test";
import assert from "node:assert/strict";
import { advanceAgentState, agentDecision, createAgentRuntimeState } from "../src/agent-runtime.js";

const now = () => new Date("2026-09-23T12:00:00.000Z");

test("agent runtime follows a bounded observable lifecycle", () => {
  let state = createAgentRuntimeState(now);
  state = advanceAgentState(state, "START", {}, now);
  assert.equal(state.enabled, true);
  assert.equal(state.phase, "WAITING");
  state = advanceAgentState(state, "OBSERVE", {}, now);
  state = advanceAgentState(state, "EVALUATE", {}, now);
  state = advanceAgentState(state, "DECIDE", { decision: { reason: "Liquidity fell." } }, now);
  state = advanceAgentState(state, "RECORDED", { decision: { reason: "Liquidity fell." }, nextRunAt: "2026-09-23T12:05:00.000Z" }, now);
  assert.equal(state.cycles, 1);
  assert.equal(state.phase, "WAITING");
  assert.equal(state.nextRunAt, "2026-09-23T12:05:00.000Z");
});

test("agent decision escalates reject-level material changes", () => {
  const decision = agentDecision({ changes: [{ level: "reject", message: "Policy changed to REJECT." }] }, { counts: { REJECT: 1 } });
  assert.deepEqual(decision, { action: "ESCALATE", reason: "Policy changed to REJECT.", alerts: 1 });
});

test("agent decision watches existing rejected markets without inventing alerts", () => {
  const decision = agentDecision({ changes: [] }, { counts: { REJECT: 7 } });
  assert.equal(decision.action, "WATCH");
  assert.equal(decision.alerts, 0);
});
