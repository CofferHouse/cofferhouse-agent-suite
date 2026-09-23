export const agentPhases = Object.freeze(["IDLE", "OBSERVING", "EVALUATING", "DECIDING", "RECORDING", "WAITING", "ERROR"]);

export function createAgentRuntimeState(now = () => new Date()) {
  return {
    phase: "IDLE",
    enabled: false,
    cycles: 0,
    lastRunAt: null,
    nextRunAt: null,
    lastDecision: "Agent mode is stopped.",
    lastError: null,
    updatedAt: now().toISOString()
  };
}

export function agentDecision(comparison, scan) {
  const critical = comparison?.changes?.filter((change) => change.level === "reject") ?? [];
  const warnings = comparison?.changes?.filter((change) => change.level === "review") ?? [];

  if (critical.length) return { action: "ESCALATE", reason: critical[0].message, alerts: critical.length + warnings.length };
  if (warnings.length) return { action: "REVIEW", reason: warnings[0].message, alerts: warnings.length };
  if ((scan?.counts?.REJECT ?? 0) > 0) return { action: "WATCH", reason: `${scan.counts.REJECT} market(s) remain outside the active policy.`, alerts: 0 };
  return { action: "NO_ACTION", reason: "No material changes require attention.", alerts: 0 };
}

export function advanceAgentState(state, event, payload = {}, now = () => new Date()) {
  const updatedAt = now().toISOString();
  switch (event) {
    case "START":
      return { ...state, enabled: true, phase: "WAITING", lastDecision: "Agent mode armed.", lastError: null, updatedAt };
    case "STOP":
      return { ...state, enabled: false, phase: "IDLE", nextRunAt: null, lastDecision: "Agent mode stopped by operator.", updatedAt };
    case "OBSERVE":
      return { ...state, phase: "OBSERVING", lastError: null, updatedAt };
    case "EVALUATE":
      return { ...state, phase: "EVALUATING", updatedAt };
    case "DECIDE":
      return { ...state, phase: "DECIDING", lastDecision: payload.decision?.reason ?? state.lastDecision, updatedAt };
    case "RECORDED":
      return {
        ...state,
        phase: state.enabled ? "WAITING" : "IDLE",
        cycles: state.cycles + 1,
        lastRunAt: payload.ranAt ?? updatedAt,
        nextRunAt: state.enabled ? payload.nextRunAt ?? null : null,
        lastDecision: payload.decision?.reason ?? state.lastDecision,
        lastError: null,
        updatedAt
      };
    case "FAIL":
      return { ...state, phase: "ERROR", lastError: String(payload.error ?? "Unknown agent error"), nextRunAt: null, updatedAt };
    default:
      return state;
  }
}
