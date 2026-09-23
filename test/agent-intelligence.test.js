import test from "node:test";
import assert from "node:assert/strict";
import { createIncidentPrompt, deterministicIncidentAnalysis, validateIncidentAnalysis } from "../src/agent-intelligence.js";

const cycle = {
  policy: { version: "scout-balanced-0.3" }, observation: { counts: { REJECT: 1 } },
  decision: { action: "ESCALATE", reason: "Policy changed to REJECT." },
  comparison: { changes: [{ message: "Policy changed to REJECT." }] }
};

test("fallback analysis preserves the deterministic decision boundary", () => {
  const analysis = deterministicIncidentAnalysis(cycle);
  assert.equal(analysis.recommendedAction, "PAUSE_AUTOMATION");
  assert.equal(analysis.source, "deterministic-fallback");
});

test("incident prompt explicitly prevents policy override and invented execution", () => {
  const prompt = createIncidentPrompt(cycle);
  assert.match(prompt, /authoritative/);
  assert.match(prompt, /Never override/);
  assert.match(prompt, /funds moved/);
});

test("rejects model actions outside the bounded allowlist", () => {
  assert.throws(() => validateIncidentAnalysis({ summary: "x", priority: "HIGH", recommended_action: "EXECUTE_TRADE", evidence: [], confidence_note: "x" }), /outside Scout bounds/);
});

test("normalizes a valid structured model analysis", () => {
  const analysis = validateIncidentAnalysis({ summary: "Review liquidity.", priority: "MEDIUM", recommended_action: "HUMAN_REVIEW", evidence: ["Liquidity fell."], confidence_note: "Based on one observation." });
  assert.equal(analysis.source, "gemini");
  assert.equal(analysis.recommendedAction, "HUMAN_REVIEW");
});
