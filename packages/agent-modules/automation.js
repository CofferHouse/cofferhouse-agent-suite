const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createPermissionPolicy({ watch, perActionCapUsd, dailyCapUsd, durationMinutes = 60, now = () => new Date() }) {
  if (watch?.schema !== "cofferhouse.guardian.watch.v1") throw new Error("A valid Guardian watch is required.");
  const createdAt = now();
  const actionCap = Math.round(clamp(finite(perActionCapUsd, watch.intent.amountUsd), 1, watch.intent.amountUsd) * 100) / 100;
  const dayCap = Math.round(clamp(finite(dailyCapUsd, actionCap), actionCap, Math.max(actionCap, watch.intent.amountUsd * 10)) * 100) / 100;
  const safeDuration = Math.round(clamp(finite(durationMinutes, 60), 5, 1440));
  return {
    schema: "cofferhouse.automation.policy.v1",
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + safeDuration * 60_000).toISOString(),
    state: "ACTIVE_SIMULATION",
    chainId: 5042,
    allowlistedTargets: [watch.target.id],
    allowedIntents: [watch.intent.kind],
    perActionCapUsd: actionCap,
    dailyCapUsd: dayCap,
    requireGuardianDecision: "HOLD_RESEARCH",
    requireFreshHumanApproval: true,
    sourceReceiptId: watch.sourceReceiptId,
    notice: "Permission simulation only. This policy is not installed in a wallet, smart account or contract and cannot execute."
  };
}

export function pausePermissionPolicy(policy, now = () => new Date()) {
  if (policy?.schema !== "cofferhouse.automation.policy.v1") throw new Error("A valid permission policy is required.");
  return { ...policy, state: "PAUSED", pausedAt: now().toISOString() };
}

export function revokePermissionPolicy(policy, now = () => new Date()) {
  if (policy?.schema !== "cofferhouse.automation.policy.v1") throw new Error("A valid permission policy is required.");
  return { ...policy, state: "REVOKED", revokedAt: now().toISOString() };
}

export function evaluatePermissionRequest({ policy, targetId, intentKind, amountUsd, spentTodayUsd = 0, guardianDecision, humanApprovalFresh = false, now = () => new Date() }) {
  if (policy?.schema !== "cofferhouse.automation.policy.v1") throw new Error("A valid permission policy is required.");
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, outcome: pass ? "pass" : "block", detail });
  const evaluatedAt = now();
  add("state", policy.state === "ACTIVE_SIMULATION", `Policy state is ${policy.state}.`);
  add("expiry", evaluatedAt.getTime() <= new Date(policy.expiresAt).getTime(), `Policy expires ${policy.expiresAt}.`);
  add("target", policy.allowlistedTargets.some((value) => value.toLowerCase() === String(targetId ?? "").toLowerCase()), "Target must match the exact allowlisted contract.");
  add("intent", policy.allowedIntents.includes(intentKind), "Intent must match the approved intent type.");
  add("action-cap", Number(amountUsd) > 0 && Number(amountUsd) <= policy.perActionCapUsd, `Amount must not exceed ${policy.perActionCapUsd} USD.`);
  add("daily-cap", Number(spentTodayUsd) >= 0 && Number(spentTodayUsd) + Number(amountUsd) <= policy.dailyCapUsd, `Modeled daily total must not exceed ${policy.dailyCapUsd} USD.`);
  add("guardian", guardianDecision === policy.requireGuardianDecision, `Guardian must report ${policy.requireGuardianDecision}.`);
  add("human", humanApprovalFresh === true, "A fresh human approval would still be required.");
  const blocked = checks.filter((item) => item.outcome === "block");
  return {
    schema: "cofferhouse.automation.evaluation.v1",
    evaluatedAt: evaluatedAt.toISOString(),
    request: { targetId, intentKind, amountUsd: Number(amountUsd), spentTodayUsd: Number(spentTodayUsd), guardianDecision, humanApprovalFresh },
    decision: blocked.length ? "WOULD_BLOCK" : "WOULD_ALLOW",
    checks,
    blockers: blocked.map((item) => item.detail),
    execution: { attempted: false, prepared: false, signed: false, submitted: false },
    notice: "Counterfactual permission evaluation only. WOULD_ALLOW does not authorize or execute a transaction."
  };
}
