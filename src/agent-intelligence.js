const allowedActions = new Set(["MONITOR", "HUMAN_REVIEW", "PAUSE_AUTOMATION"]);

export function deterministicIncidentAnalysis(cycle) {
  const action = cycle.decision.action === "ESCALATE" ? "PAUSE_AUTOMATION"
    : cycle.decision.action === "REVIEW" ? "HUMAN_REVIEW" : "MONITOR";
  return {
    source: "deterministic-fallback",
    summary: cycle.decision.reason,
    priority: cycle.decision.action === "ESCALATE" ? "HIGH" : cycle.decision.action === "REVIEW" ? "MEDIUM" : "LOW",
    recommendedAction: action,
    evidence: (cycle.comparison?.changes ?? []).slice(0, 3).map((change) => change.message),
    confidenceNote: "Generated directly from deterministic Scout policy evidence; no model was used."
  };
}

export function createIncidentPrompt(cycle) {
  return [
    "You are the bounded risk explanation layer for CofferHouse Scout.",
    "The deterministic policy result below is authoritative. Never override it, invent market facts, recommend a trade, or claim that funds moved.",
    "Explain the incident for a human operator and choose only the safest permitted next step.",
    JSON.stringify({ policy: cycle.policy, observation: cycle.observation, decision: cycle.decision, changes: cycle.comparison?.changes ?? [] })
  ].join("\n\n");
}

export function validateIncidentAnalysis(value) {
  if (!value || typeof value !== "object") throw new Error("Gemini analysis is not an object.");
  if (!["LOW", "MEDIUM", "HIGH"].includes(value.priority)) throw new Error("Gemini returned an invalid priority.");
  if (!allowedActions.has(value.recommended_action)) throw new Error("Gemini returned an action outside Scout bounds.");
  if (typeof value.summary !== "string" || typeof value.confidence_note !== "string" || !Array.isArray(value.evidence)) throw new Error("Gemini analysis is incomplete.");
  return {
    source: "gemini",
    summary: value.summary,
    priority: value.priority,
    recommendedAction: value.recommended_action,
    evidence: value.evidence.filter((item) => typeof item === "string").slice(0, 5),
    confidenceNote: value.confidence_note
  };
}
