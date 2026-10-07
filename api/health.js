import { durableStoreConfigured, getJson } from "./_redis.js";
import { geminiConfigured } from "./_gemini.js";
import { notificationConfigured } from "./_notify.js";
import { deploymentCapabilities, evaluateDeploymentReadiness, ownerActivationStep } from "../packages/agent-core/index.js";

const STATUS_KEY = "cofferhouse:scout:agent-status";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "no-store");
  const capabilities = { ...deploymentCapabilities(process.env), durableMemory: durableStoreConfigured(), outboundAlerts: notificationConfigured(), boundedIntelligence: geminiConfigured() };
  let latestStatus = null;
  if (capabilities.durableMemory) {
    try { latestStatus = await getJson(STATUS_KEY); } catch { /* Readiness remains safe and reports no healthy run. */ }
  }
  const deployment = evaluateDeploymentReadiness({ capabilities, lastRunAt: latestStatus?.ranAt });
  const ownerActivation = ownerActivationStep(deployment, capabilities);
  return response.status(200).json({
    ok: true,
    service: "cofferhouse-scout",
    version: "0.1.0",
    mode: "read-only",
    readyForUnattendedCycles: deployment.readyForUnattendedCycles,
    capabilities,
    deployment,
    ownerActivation,
    checkedAt: new Date().toISOString()
  });
}
