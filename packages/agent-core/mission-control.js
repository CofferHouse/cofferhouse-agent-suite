export function buildMissionControl({ scan, session = null, actionPreview = null, actionApproval = null, guardianObservation = null, durableGuardianObservation = null, automationEvaluation = null, deployment = null } = {}) {
  const counts = scan?.counts ?? { PASS: 0, REVIEW: 0, REJECT: 0 };
  const dataMode = session?.dataMode ?? (scan?.ranked?.every((item) => item.market?.dataMode === "live") ? "live" : "demo");
  const deploymentStatus = deployment?.status ?? "SETUP_REQUIRED";
  const activeGuardianObservation = durableGuardianObservation?.requiresHumanAttention ? durableGuardianObservation : guardianObservation;
  const guardianAttention = activeGuardianObservation?.requiresHumanAttention === true;
  const actionBlocked = actionPreview?.status === "BLOCKED";
  const actionNeedsApproval = Boolean(actionPreview && !actionApproval && !actionBlocked);
  const automationBlocked = automationEvaluation?.decision === "BLOCKED";

  let status = "READY";
  let headline = "Research is inside the current control boundary.";
  let detail = "Review the coordinated evidence before creating any separate action preview.";
  let nextAction = session
    ? { kind: "OPEN_VIEW", view: "action", label: "REVIEW ACTION CENTER", reason: "A coordinated session is available for human review." }
    : { kind: "RUN_SESSION", view: "hub", label: "RUN RESEARCH SESSION", reason: "No coordinated research session exists yet." };

  if (guardianAttention) {
    status = "ATTENTION";
    headline = "Guardian requires human attention.";
    detail = activeGuardianObservation.reasons?.[0] ?? activeGuardianObservation.reason ?? "Fresh evidence moved outside the recorded intent limits.";
    nextAction = { kind: "OPEN_VIEW", view: "guardian", label: "OPEN GUARDIAN", reason: "Review the latest Guardian decision before any other step." };
  } else if (actionBlocked || automationBlocked) {
    status = "BLOCKED";
    headline = "A downstream request is blocked.";
    detail = actionBlocked ? actionPreview.blockers?.[0] ?? "Action Center found a blocking check." : automationEvaluation.reason ?? "Automation limits rejected the request.";
    nextAction = { kind: "OPEN_VIEW", view: actionBlocked ? "action" : "automation", label: actionBlocked ? "OPEN ACTION CENTER" : "OPEN AUTOMATION", reason: detail };
  } else if (actionNeedsApproval) {
    status = "HUMAN_REVIEW";
    headline = "One action preview awaits human review.";
    detail = "The preview cannot progress until the visible checks are reviewed and one informed approval is recorded.";
    nextAction = { kind: "OPEN_VIEW", view: "action", label: "REVIEW PREVIEW", reason: detail };
  } else if (deploymentStatus === "DEGRADED_STALE") {
    status = "DEGRADED";
    headline = "The 24/7 agent has missed its expected cycle window.";
    detail = "Inspect the protected scheduler and latest server diagnostic before relying on unattended monitoring.";
    nextAction = { kind: "OPEN_VIEW", view: "scout", label: "CHECK SERVER AGENT", reason: detail };
  } else if (!session) {
    status = "IDLE";
    headline = "The agents are ready for a coordinated research session.";
    detail = "Run the bounded chain to create one trace across Scout, Opportunity, Strategy and the human gate.";
  } else if (session.summary.decision === "NO_ELIGIBLE_ALLOCATION") {
    status = "NO_ALLOCATION";
    headline = "No allocation clears the current research limits.";
    detail = "This is a valid outcome. Review exclusions or wait for new market evidence; no position was invented.";
    nextAction = { kind: "OPEN_VIEW", view: "opportunity", label: "REVIEW EXCLUSIONS", reason: detail };
  }

  const attentionCount = (counts.REVIEW ?? 0) + (counts.REJECT ?? 0) + Number(guardianAttention) + Number(actionBlocked) + Number(automationBlocked);
  return {
    schema: "cofferhouse.mission-control.v1",
    status,
    headline,
    detail,
    attentionCount,
    nextAction,
    indicators: [
      { id: "data", label: "DATA", value: dataMode.toUpperCase(), tone: dataMode === "live" ? "good" : "review", detail: `${scan?.total ?? 0} market observations` },
      { id: "risk", label: "RISK FLAGS", value: String((counts.REVIEW ?? 0) + (counts.REJECT ?? 0)), tone: counts.REJECT ? "danger" : counts.REVIEW ? "review" : "good", detail: `${counts.REVIEW ?? 0} review · ${counts.REJECT ?? 0} reject` },
      { id: "research", label: "MODELED POSITIONS", value: String((session?.summary.lendingPositions ?? 0) + (session?.summary.dexPositions ?? 0)), tone: session ? "good" : "neutral", detail: session?.summary.decision?.replaceAll("_", " ") ?? "No session" },
      { id: "gate", label: "HUMAN GATE", value: actionApproval ? "RECORDED" : actionPreview ? "PENDING" : "CLEAR", tone: actionNeedsApproval ? "review" : "neutral", detail: actionPreview ? actionPreview.status.replaceAll("_", " ") : "No action preview" },
      { id: "runtime", label: "24/7 CORE", value: deploymentStatus.replaceAll("_", " "), tone: deploymentStatus === "OPERATIONAL" ? "good" : deploymentStatus === "DEGRADED_STALE" ? "danger" : "review", detail: deployment?.ageMinutes === null || deployment?.ageMinutes === undefined ? "No recorded cycle" : `${deployment.ageMinutes} min since run` }
    ],
    boundary: { custody: false, signature: false, execution: false }
  };
}
