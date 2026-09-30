function fingerprintText(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createAgentAlert(cycle) {
  if (!cycle?.decision || !["REVIEW", "ESCALATE"].includes(cycle.decision.action)) return null;
  const changes = cycle.comparison?.changes ?? [];
  const signature = JSON.stringify({
    action: cycle.decision.action,
    reason: cycle.decision.reason,
    changes: changes.map(({ marketId, level, type }) => ({ marketId, level, type }))
  });
  return {
    schema: "cofferhouse.scout.agent-alert.v1",
    fingerprint: `alert-${fingerprintText(signature)}`,
    createdAt: cycle.ranAt,
    severity: cycle.decision.action,
    title: `Scout ${cycle.decision.action}: ${changes.length} material change${changes.length === 1 ? "" : "s"}`,
    message: cycle.decision.reason,
    policyVersion: cycle.policy.version,
    changes: changes.slice(0, 10)
  };
}

export function createGuardianAlert(receipt) {
  const observation = receipt?.schema === "cofferhouse.guardian.receipt.v1" ? receipt.observation : null;
  if (!observation?.requiresHumanAttention) return null;
  const signature = JSON.stringify({ targetId: observation.target?.id?.toLowerCase(), decision: observation.decision, reasons: observation.reasons });
  return {
    schema: "cofferhouse.guardian.agent-alert.v1",
    fingerprint: `guardian-${fingerprintText(signature)}`,
    createdAt: observation.observedAt,
    severity: observation.decision === "STOP_EXIT_RESEARCH" ? "ESCALATE" : "REVIEW",
    title: `Guardian ${observation.decision.replaceAll("_", " ")}: ${observation.target?.name ?? "watched intent"}`,
    message: observation.reasons[0] ?? "Guardian requires human attention.",
    policyVersion: "guardian-limits-v1",
    target: observation.target,
    reasons: observation.reasons.slice(0, 10)
  };
}
