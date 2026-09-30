import { durableStoreConfigured, getJson } from "./_redis.js";
import { geminiConfigured } from "./_gemini.js";
import { notificationConfigured } from "./_notify.js";
import { evaluateDeploymentReadiness } from "../packages/agent-core/index.js";

const STATUS_KEY = "cofferhouse:scout:agent-status";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "no-store");
  const capabilities = {
    durableMemory: durableStoreConfigured(),
    protectedScheduler: Boolean(process.env.CRON_SECRET),
    arcRpcVerification: Boolean(process.env.ARC_RPC_URL),
    outboundAlerts: notificationConfigured(),
    boundedIntelligence: geminiConfigured(),
    humanAcknowledgment: Boolean(process.env.SCOUT_OPERATOR_TOKEN),
    officialUniswapQuotes: Boolean(process.env.UNISWAP_API_KEY),
    onchainAnchor: Boolean(process.env.SCOUT_RECEIPT_REGISTRY_ADDRESS)
  };
  let latestStatus = null;
  if (capabilities.durableMemory) {
    try { latestStatus = await getJson(STATUS_KEY); } catch { /* Readiness remains safe and reports no healthy run. */ }
  }
  const deployment = evaluateDeploymentReadiness({ capabilities, lastRunAt: latestStatus?.ranAt });
  return response.status(200).json({
    ok: true,
    service: "cofferhouse-scout",
    version: "0.1.0",
    mode: "read-only",
    readyForUnattendedCycles: deployment.readyForUnattendedCycles,
    capabilities,
    deployment,
    checkedAt: new Date().toISOString()
  });
}
