import { durableStoreConfigured } from "./_redis.js";
import { geminiConfigured } from "./_gemini.js";
import { notificationConfigured } from "./_notify.js";

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
  return response.status(200).json({
    ok: true,
    service: "cofferhouse-scout",
    version: "0.1.0",
    mode: "read-only",
    readyForUnattendedCycles: capabilities.durableMemory && capabilities.protectedScheduler,
    capabilities,
    checkedAt: new Date().toISOString()
  });
}
