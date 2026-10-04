import { randomUUID } from "node:crypto";
import { deleteJsonIfValue, getJson, pushJson, setJson, setJsonIfAbsent, durableStoreConfigured } from "../_redis.js";
import { fetchMorphoArcMarkets, verifyArcMarketContracts } from "../../packages/arc-data/index.js";
import { policyProfiles } from "../../packages/policies/index.js";
import { createAgentAlert, createGuardianAlert, runAgentCycle } from "../../packages/agent-core/index.js";
import { compareArcCctpObservations, evaluateDurableGuardianPortfolio, fetchArcCctpObservation, runResearchSession } from "../../packages/agent-modules/index.js";
import { deliverAlert, notificationConfigured } from "../_notify.js";
import { analyzeAgentCycle } from "../_gemini.js";
import { createInteropReceipt, createResearchSessionReceipt, sealDocument } from "../../packages/evidence/index.js";
import { withRetry } from "../../packages/shared/index.js";

const SNAPSHOT_KEY = "cofferhouse:scout:latest-snapshot";
const STATUS_KEY = "cofferhouse:scout:agent-status";
const HISTORY_KEY = "cofferhouse:scout:agent-history";
const LAST_ALERT_KEY = "cofferhouse:scout:last-alert";
const RESEARCH_SESSION_KEY = "cofferhouse:agent-hub:latest-session";
const RESEARCH_HISTORY_KEY = "cofferhouse:agent-hub:session-history";
const GUARDIAN_WATCH_KEY = "cofferhouse:guardian:active-watch";
const GUARDIAN_LATEST_KEY = "cofferhouse:guardian:latest-receipt";
const GUARDIAN_HISTORY_KEY = "cofferhouse:guardian:receipt-history";
const GUARDIAN_ALERT_KEY = "cofferhouse:guardian:last-alert";
const INTEROP_LATEST_KEY = "cofferhouse:interop:latest-receipt";
const INTEROP_HISTORY_KEY = "cofferhouse:interop:receipt-history";
const RUN_LOCK_KEY = "cofferhouse:scout:run-lock";
const RUN_ATTEMPT_KEY = "cofferhouse:scout:last-run-attempt";
const FAILURE_HISTORY_KEY = "cofferhouse:scout:failure-history";

export function isScheduledRunAuthorized(request, secret = process.env.CRON_SECRET) {
  return Boolean(secret) && request.headers.authorization === `Bearer ${secret}`;
}

const asList = (value) => Array.isArray(value) ? value : value ? [value] : [];

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (!isScheduledRunAuthorized(request)) return response.status(401).json({ ok: false, error: "Unauthorized" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });

  const startedAt = new Date().toISOString();
  const lock = { runId: randomUUID(), startedAt };
  if (!await setJsonIfAbsent(RUN_LOCK_KEY, lock, 90)) {
    const activeAttempt = await getJson(RUN_ATTEMPT_KEY);
    return response.status(409).json({ ok: false, state: "ALREADY_RUNNING", runId: activeAttempt?.runId ?? null, startedAt: activeAttempt?.startedAt ?? null });
  }
  const recordAttempt = (phase, extra = {}) => setJson(RUN_ATTEMPT_KEY, { schema: "cofferhouse.scout.run-attempt.v1", runId: lock.runId, startedAt, updatedAt: new Date().toISOString(), state: "RUNNING", phase, ...extra });

  try {
    await recordAttempt("LOAD_DURABLE_STATE");
    const [previousMarkets, guardianRegistrationState, previousInteropReceipt] = await Promise.all([getJson(SNAPSHOT_KEY), getJson(GUARDIAN_WATCH_KEY), getJson(INTEROP_LATEST_KEY)]);
    const guardianRegistrations = asList(guardianRegistrationState).filter((item) => item?.schema === "cofferhouse.guardian.registration.v1" && item.watch?.source === "LENDING").slice(0, 20);
    await recordAttempt("OBSERVE_ARC_MARKETS");
    let currentMarkets = await withRetry(() => fetchMorphoArcMarkets(), { attempts: 3, delayMs: 500 });
    let verification = { configured: Boolean(process.env.ARC_RPC_URL), status: "not-configured", source: "Arc JSON-RPC · eth_getCode" };
    if (process.env.ARC_RPC_URL) {
      try {
        const rpcResult = await verifyArcMarketContracts(currentMarkets, process.env.ARC_RPC_URL);
        currentMarkets = rpcResult.markets;
        verification = rpcResult.summary;
      } catch (error) {
        console.error("Arc RPC verification unavailable:", error instanceof Error ? error.name : "Unknown error");
        verification = { configured: true, status: "unavailable", source: "Arc JSON-RPC · eth_getCode", error: "Arc RPC verification request failed; deterministic Morpho evaluation continued without an independent contract check." };
      }
    }
    let interop = { configured: Boolean(process.env.ARC_RPC_URL), status: "NOT_CONFIGURED", receipt: null, error: null };
    if (process.env.ARC_RPC_URL) {
      try {
        const rawObservation = await fetchArcCctpObservation(process.env.ARC_RPC_URL, { blocks: 500 });
        const comparison = compareArcCctpObservations(previousInteropReceipt?.observation, rawObservation);
        const observation = { ...rawObservation, comparison };
        interop = { configured: true, status: comparison.status, receipt: createInteropReceipt(observation), error: null };
      } catch {
        interop = { configured: true, status: "UNAVAILABLE", receipt: null, error: "CCTP observation failed safely; no crosschain activity claim was produced." };
      }
    }
    await recordAttempt("EVALUATE_AND_COMPARE");
    const cycle = runAgentCycle({
      currentMarkets,
      previousMarkets,
      policy: policyProfiles.balanced,
      limits: { liquidityChangePct: 5, utilizationChangePts: 2 }
    });
    const researchSession = runResearchSession({
      markets: currentMarkets,
      policy: policyProfiles.balanced,
      now: () => cycle.ranAt
    });
    const researchSessionReceipt = createResearchSessionReceipt(researchSession);
    const guardianReceipts = evaluateDurableGuardianPortfolio({ registrations: guardianRegistrations, markets: currentMarkets, policy: policyProfiles.balanced, now: () => new Date(cycle.ranAt) });
    const intelligence = await analyzeAgentCycle(cycle);
    const alert = createAgentAlert(cycle);
    let notification = { configured: notificationConfigured(), delivered: false, reason: alert ? "duplicate-or-pending" : "no-material-alert" };
    if (alert) {
      const previousAlert = await getJson(LAST_ALERT_KEY);
      if (previousAlert?.fingerprint !== alert.fingerprint) {
        const delivery = await deliverAlert(alert);
        notification = { configured: notificationConfigured(), ...delivery, fingerprint: alert.fingerprint };
        if (delivery.delivered) await setJson(LAST_ALERT_KEY, alert);
      } else {
        notification = { configured: notificationConfigured(), delivered: false, reason: "duplicate", fingerprint: alert.fingerprint };
      }
    }
    const guardianAlerts = guardianReceipts.map(createGuardianAlert).filter(Boolean);
    const priorGuardianAlerts = asList(await getJson(GUARDIAN_ALERT_KEY));
    const deliveredGuardianAlerts = [...priorGuardianAlerts];
    const guardianNotifications = [];
    for (const guardianAlert of guardianAlerts) {
      if (!priorGuardianAlerts.some((item) => item.fingerprint === guardianAlert.fingerprint)) {
        const delivery = await deliverAlert(guardianAlert);
        guardianNotifications.push({ configured: notificationConfigured(), ...delivery, fingerprint: guardianAlert.fingerprint });
        if (delivery.delivered) deliveredGuardianAlerts.unshift(guardianAlert);
      } else {
        guardianNotifications.push({ configured: notificationConfigured(), delivered: false, reason: "duplicate", fingerprint: guardianAlert.fingerprint });
      }
    }
    if (deliveredGuardianAlerts.length !== priorGuardianAlerts.length) await setJson(GUARDIAN_ALERT_KEY, deliveredGuardianAlerts.slice(0, 100));
    const { markets: _privateMarkets, ...cycleWithoutMarkets } = cycle;
    const verificationTrace = {
      phase: "VERIFY",
      status: verification.status === "verified" ? "COMPLETE" : verification.status.toUpperCase(),
      detail: verification.status === "verified"
        ? `${verification.marketsVerified} markets independently confirmed through Arc RPC.`
        : verification.error ?? "Independent Arc RPC verification was not complete.",
      at: cycle.ranAt
    };
    const trace = [
      cycle.trace[0],
      verificationTrace,
      { phase: "INTEROP", status: interop.status, detail: interop.receipt ? `${interop.receipt.observation.counts.total} CCTP V2 events observed; ${interop.receipt.observation.comparison.newEvents} are new versus the prior window.` : interop.error ?? "Arc RPC is not configured for crosschain observation.", at: cycle.ranAt },
      ...cycle.trace.slice(1),
      { phase: "RECORD", status: "READY", detail: "Sealed cycle prepared for durable storage.", at: cycle.ranAt }
    ];
    const guardian = guardianReceipts.length ? { active: true, watchCount: guardianReceipts.length, decisions: guardianReceipts.map((receipt) => ({ receiptId: receipt.receiptId, target: receipt.watch.target, decision: receipt.observation.decision, requiresHumanAttention: receipt.observation.requiresHumanAttention })), alerts: guardianAlerts, notifications: guardianNotifications } : { active: false, watchCount: 0, decisions: [], alerts: [], notifications: [] };
    const publicCycle = sealDocument({ ...cycleWithoutMarkets, trace, verification, interop: { configured: interop.configured, status: interop.status, receiptId: interop.receipt?.receiptId ?? null, counts: interop.receipt?.observation.counts ?? null, error: interop.error }, intelligence, alert, notification, guardian }, "cycle");
    await recordAttempt("COMMIT_DURABLE_EVIDENCE", { cycleRanAt: cycle.ranAt });
    await setJson(SNAPSHOT_KEY, currentMarkets);
    await setJson(STATUS_KEY, publicCycle);
    await pushJson(HISTORY_KEY, publicCycle, 100);
    await setJson(RESEARCH_SESSION_KEY, researchSessionReceipt);
    await pushJson(RESEARCH_HISTORY_KEY, researchSessionReceipt, 25);
    if (guardianReceipts.length) {
      await setJson(GUARDIAN_LATEST_KEY, guardianReceipts);
      for (const guardianReceipt of guardianReceipts) await pushJson(GUARDIAN_HISTORY_KEY, guardianReceipt, 50);
    }
    if (interop.receipt) {
      await setJson(INTEROP_LATEST_KEY, interop.receipt);
      await pushJson(INTEROP_HISTORY_KEY, interop.receipt, 50);
    }
    await setJson(RUN_ATTEMPT_KEY, { schema: "cofferhouse.scout.run-attempt.v1", runId: lock.runId, startedAt, updatedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), state: "SUCCEEDED", phase: "COMPLETE", cycleRanAt: cycle.ranAt });
    return response.status(200).json({ ok: true, runId: lock.runId, cycle: publicCycle, researchSession: researchSessionReceipt, guardians: guardianReceipts, interop: interop.receipt });
  } catch (error) {
    const failure = {
      schema: "cofferhouse.scout.agent-error.v1",
      ranAt: new Date().toISOString(),
      error: error.message,
      source: error.provider ? { provider: error.provider, code: error.code, retryable: error.retryable, status: error.status ?? null } : null
    };
    try {
      await setJson(RUN_ATTEMPT_KEY, { ...failure, runId: lock.runId, startedAt, updatedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), state: "FAILED", phase: "RECOVERABLE_FAILURE" });
      await pushJson(FAILURE_HISTORY_KEY, { ...failure, runId: lock.runId }, 25);
    } catch {}
    return response.status(500).json({ ok: false, runId: lock.runId, recoverable: true, preservedLastSuccessfulCycle: true, ...failure });
  } finally {
    try { await deleteJsonIfValue(RUN_LOCK_KEY, lock); } catch {}
  }
}
