const boolean = (value) => value === true;

export function evaluateDeploymentReadiness({ capabilities = {}, lastRunAt = null, runAttempt = null, now = () => new Date(), expectedIntervalMinutes = 15 } = {}) {
  const required = [
    { id: "durable-memory", label: "Durable memory", ready: boolean(capabilities.durableMemory), detail: "Upstash REST storage" },
    { id: "protected-scheduler", label: "Protected scheduler", ready: boolean(capabilities.protectedScheduler), detail: "Shared scheduler credential" }
  ];
  const recommended = [
    { id: "arc-rpc", label: "Independent Arc RPC", ready: boolean(capabilities.arcRpcVerification), detail: "Contract bytecode verification" },
    { id: "operator-ack", label: "Human acknowledgment", ready: boolean(capabilities.humanAcknowledgment), detail: "Protected operator token" },
    { id: "uniswap-quotes", label: "Official DEX quotes", ready: boolean(capabilities.officialUniswapQuotes), detail: "Server-side Uniswap API" }
  ];
  const missingRequired = required.filter((item) => !item.ready).map((item) => item.id);
  const parsedLastRun = lastRunAt ? new Date(lastRunAt) : null;
  const validLastRun = parsedLastRun && Number.isFinite(parsedLastRun.getTime());
  const ageMinutes = validLastRun ? Math.max(0, Math.round((now().getTime() - parsedLastRun.getTime()) / 60_000)) : null;
  const staleAfterMinutes = Math.max(45, expectedIntervalMinutes * 3);
  const stale = ageMinutes !== null && ageMinutes > staleAfterMinutes;
  const attemptTime = runAttempt?.updatedAt ? new Date(runAttempt.updatedAt) : null;
  const attemptAgeMinutes = attemptTime && Number.isFinite(attemptTime.getTime()) ? Math.max(0, Math.round((now().getTime() - attemptTime.getTime()) / 60_000)) : null;
  const interrupted = runAttempt?.state === "RUNNING" && attemptAgeMinutes !== null && attemptAgeMinutes > 3;
  const failedAfterSuccess = runAttempt?.state === "FAILED" && (!validLastRun || new Date(runAttempt.updatedAt).getTime() > parsedLastRun.getTime());
  const status = missingRequired.length
    ? "SETUP_REQUIRED"
    : interrupted
      ? "DEGRADED_INTERRUPTED"
      : failedAfterSuccess
        ? "DEGRADED_RECOVERABLE"
        : runAttempt?.state === "RUNNING"
          ? "RUNNING"
    : ageMinutes === null
      ? "READY_FOR_FIRST_RUN"
      : stale
        ? "DEGRADED_STALE"
        : "OPERATIONAL";

  return {
    schema: "cofferhouse.deployment-readiness.v1",
    status,
    readyForUnattendedCycles: missingRequired.length === 0,
    healthy: status === "OPERATIONAL",
    missingRequired,
    lastRunAt: validLastRun ? parsedLastRun.toISOString() : null,
    ageMinutes,
    staleAfterMinutes,
    required,
    recommended,
    recovery: {
      state: interrupted ? "LOCK_EXPIRES_AUTOMATICALLY" : failedAfterSuccess ? "LAST_SUCCESS_PRESERVED" : runAttempt?.state ?? "IDLE",
      runId: runAttempt?.runId ?? null,
      phase: runAttempt?.phase ?? null,
      attemptAgeMinutes
    }
  };
}
