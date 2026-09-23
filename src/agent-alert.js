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
