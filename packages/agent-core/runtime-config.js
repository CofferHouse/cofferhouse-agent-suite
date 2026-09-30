const PLACEHOLDER_PATTERN = /(replace-with|your-|example|changeme|todo|placeholder)/i;

export function configuredSecret(value, minimumLength = 16) {
  const normalized = String(value ?? "").trim();
  return normalized.length >= minimumLength && !PLACEHOLDER_PATTERN.test(normalized);
}

export function configuredHttpsEndpoint(value) {
  try {
    const normalized = String(value ?? "").trim();
    if (!normalized || PLACEHOLDER_PATTERN.test(normalized)) return false;
    return new URL(normalized).protocol === "https:";
  } catch {
    return false;
  }
}

export function deploymentCapabilities(environment = {}) {
  return Object.freeze({
    durableMemory: configuredHttpsEndpoint(environment.UPSTASH_REDIS_REST_URL) && configuredSecret(environment.UPSTASH_REDIS_REST_TOKEN),
    protectedScheduler: configuredSecret(environment.CRON_SECRET),
    arcRpcVerification: configuredHttpsEndpoint(environment.ARC_RPC_URL),
    outboundAlerts: configuredHttpsEndpoint(environment.SCOUT_ALERT_WEBHOOK_URL),
    boundedIntelligence: configuredSecret(environment.GEMINI_API_KEY, 8),
    humanAcknowledgment: configuredSecret(environment.SCOUT_OPERATOR_TOKEN),
    officialUniswapQuotes: configuredSecret(environment.UNISWAP_API_KEY, 8),
    onchainAnchor: /^0x[a-fA-F0-9]{40}$/.test(String(environment.SCOUT_RECEIPT_REGISTRY_ADDRESS ?? ""))
  });
}
