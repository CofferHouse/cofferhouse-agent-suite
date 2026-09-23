import { getJson, pushJson, setJson, durableStoreConfigured } from "../_redis.js";
import { fetchMorphoArcMarkets } from "../../src/morpho.js";
import { policyProfiles } from "../../src/policy.js";
import { runAgentCycle } from "../../src/agent-cycle.js";
import { createAgentAlert } from "../../src/agent-alert.js";
import { deliverAlert, notificationConfigured } from "../_notify.js";
import { analyzeAgentCycle } from "../_gemini.js";
import { sealDocument } from "../../src/integrity.js";
import { verifyArcMarketContracts } from "../../src/arc-rpc.js";
import { withRetry } from "../../src/retry.js";

const SNAPSHOT_KEY = "cofferhouse:scout:latest-snapshot";
const STATUS_KEY = "cofferhouse:scout:agent-status";
const HISTORY_KEY = "cofferhouse:scout:agent-history";
const LAST_ALERT_KEY = "cofferhouse:scout:last-alert";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (!authorized(request)) return response.status(401).json({ ok: false, error: "Unauthorized" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });

  try {
    const previousMarkets = await getJson(SNAPSHOT_KEY);
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
    const cycle = runAgentCycle({
      currentMarkets,
      previousMarkets,
      policy: policyProfiles.balanced,
      limits: { liquidityChangePct: 5, utilizationChangePts: 2 }
    });
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
      ...cycle.trace.slice(1),
      { phase: "RECORD", status: "READY", detail: "Sealed cycle prepared for durable storage.", at: cycle.ranAt }
    ];
    const publicCycle = sealDocument({ ...cycleWithoutMarkets, trace, verification, intelligence, alert, notification }, "cycle");
    await setJson(SNAPSHOT_KEY, currentMarkets);
    await setJson(STATUS_KEY, publicCycle);
    await pushJson(HISTORY_KEY, publicCycle, 100);
    return response.status(200).json({ ok: true, cycle: publicCycle });
  } catch (error) {
    const failure = {
      schema: "cofferhouse.scout.agent-error.v1",
      ranAt: new Date().toISOString(),
      error: error.message,
      source: error.provider ? { provider: error.provider, code: error.code, retryable: error.retryable, status: error.status ?? null } : null
    };
    try {
      await setJson(STATUS_KEY, failure);
      await pushJson(HISTORY_KEY, failure, 100);
    } catch {}
    return response.status(500).json({ ok: false, ...failure });
  }
}
