import { durableStoreConfigured, getJson, listJson } from "../_redis.js";

const STATUS_KEY = "cofferhouse:scout:agent-status";
const HISTORY_KEY = "cofferhouse:scout:agent-history";
const ACK_KEY = "cofferhouse:scout:latest-acknowledgment";

function runtimeCapabilities() {
  return {
    durableMemory: durableStoreConfigured(),
    protectedScheduler: Boolean(process.env.CRON_SECRET),
    outboundAlerts: Boolean(process.env.SCOUT_ALERT_WEBHOOK_URL),
    boundedIntelligence: Boolean(process.env.GEMINI_API_KEY),
    humanAcknowledgment: Boolean(process.env.SCOUT_OPERATOR_TOKEN),
    arcRpcVerification: Boolean(process.env.ARC_RPC_URL),
    officialUniswapQuotes: Boolean(process.env.UNISWAP_API_KEY),
    onchainAnchor: Boolean(process.env.SCOUT_RECEIPT_REGISTRY_ADDRESS)
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ configured: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "no-store");
  if (!durableStoreConfigured()) {
    return response.status(200).json({ configured: false, capabilities: runtimeCapabilities(), status: null, history: [] });
  }
  try {
    const [status, history, acknowledgment] = await Promise.all([getJson(STATUS_KEY), listJson(HISTORY_KEY, 10), getJson(ACK_KEY)]);
    return response.status(200).json({ configured: true, capabilities: runtimeCapabilities(), status, history, acknowledgment });
  } catch (error) {
    return response.status(500).json({ configured: true, capabilities: runtimeCapabilities(), error: error.message, status: null, history: [] });
  }
}
