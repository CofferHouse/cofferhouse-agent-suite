const step = (id, order, title, action, verification) => Object.freeze({ id, order, title, action, verification, secretsInResponse: false });

export function ownerActivationStep(deployment = {}, capabilities = {}) {
  const missing = new Set(deployment.missingRequired ?? []);
  if (missing.has("durable-memory")) {
    return step(
      "CONNECT_UPSTASH",
      1,
      "Connect durable memory",
      "Create or open one Upstash Redis database, then add its REST URL and standard REST token directly to the Vercel project as server-side environment variables.",
      "Refresh /api/health and confirm required.durable-memory.ready is true. Never paste either value into chat, GitHub or a VITE_ variable."
    );
  }
  if (missing.has("protected-scheduler")) {
    return step(
      "ADD_CRON_SECRET",
      2,
      "Protect the scheduler",
      "Generate one random CRON_SECRET of at least 32 characters and save it directly in Vercel. Keep a temporary private copy for the matching GitHub Actions secret.",
      "Refresh /api/health and confirm required.protected-scheduler.ready is true. Do not send the secret through chat."
    );
  }
  if (deployment.status === "READY_FOR_FIRST_RUN") {
    return step(
      "RUN_FIRST_CYCLE",
      3,
      "Run the first protected cycle",
      "Add SCOUT_AGENT_URL and the same CRON_SECRET to GitHub Actions secrets, then manually run the Scout Agent Cycle workflow once.",
      "Wait for the workflow to succeed, then confirm /api/health reports OPERATIONAL and /api/agent/status reports one durable cycle."
    );
  }
  if (["DEGRADED_INTERRUPTED", "DEGRADED_RECOVERABLE", "DEGRADED_STALE"].includes(deployment.status)) {
    return step(
      "RECOVER_CYCLE",
      4,
      "Recover the protected cycle",
      "Inspect the latest Scout Agent Cycle workflow, correct the reported configuration or provider failure, and run it once more. Do not delete the preserved durable history.",
      "Confirm /api/health returns OPERATIONAL and lastRunAt advances."
    );
  }
  if (deployment.status === "RUNNING") {
    return step(
      "WAIT_FOR_CYCLE",
      4,
      "Wait for the active cycle",
      "Do not start a duplicate run while the durable lock is active.",
      "Refresh /api/health after the workflow finishes and confirm OPERATIONAL."
    );
  }
  if (deployment.status === "OPERATIONAL" && !capabilities.arcRpcVerification) {
    return step(
      "ADD_ARC_RPC",
      5,
      "Strengthen Arc verification",
      "Add a dedicated HTTPS Arc mainnet RPC URL directly to Vercel as ARC_RPC_URL, then redeploy.",
      "Confirm /api/health reports capabilities.arcRpcVerification as true."
    );
  }
  if (deployment.status === "OPERATIONAL" && !capabilities.humanAcknowledgment) {
    return step(
      "ADD_OPERATOR_TOKEN",
      6,
      "Protect human acknowledgments",
      "Generate a different random SCOUT_OPERATOR_TOKEN of at least 32 characters and save it directly in Vercel.",
      "Confirm /api/health reports capabilities.humanAcknowledgment as true. Never reuse CRON_SECRET."
    );
  }
  return step(
    "CORE_ACTIVATION_COMPLETE",
    7,
    "Core activation complete",
    "Keep the protected scheduler enabled and review material alerts and stale-cycle diagnostics.",
    "Confirm /api/health remains OPERATIONAL and lastRunAt continues to advance."
  );
}

