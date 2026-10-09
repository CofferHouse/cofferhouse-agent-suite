import test from "node:test";
import assert from "node:assert/strict";
import { configuredHttpsEndpoint, configuredSecret, deploymentCapabilities } from "../packages/agent-core/index.js";

test("deployment configuration rejects examples and insecure endpoints", () => {
  assert.equal(configuredSecret("replace-with-a-long-random-value"), false);
  assert.equal(configuredSecret("real-secret-value-123456"), true);
  assert.equal(configuredHttpsEndpoint("http://localhost:1234"), false);
  assert.equal(configuredHttpsEndpoint("https://your-database.example"), false);
  assert.equal(configuredHttpsEndpoint("https://rpc.vendor.net/key"), true);
});

test("capabilities report only credible production configuration", () => {
  const capabilities = deploymentCapabilities({
    UPSTASH_REDIS_REST_URL: "https://redis.vendor.net",
    UPSTASH_REDIS_REST_TOKEN: "durable-token-123456789",
    CRON_SECRET: "scheduler-secret-123456",
    ARC_RPC_URL: "https://rpc.vendor.net/key",
    SCOUT_OPERATOR_TOKEN: "operator-secret-1234567"
  });
  assert.equal(capabilities.durableMemory, true);
  assert.equal(capabilities.protectedScheduler, true);
  assert.equal(capabilities.arcRpcVerification, true);
  assert.equal(capabilities.humanAcknowledgment, true);
  assert.equal(capabilities.outboundAlerts, false);
  assert.equal(capabilities.onchainAnchor, false);
});

test("Telegram credentials activate outbound alerts without a generic webhook", () => {
  const capabilities = deploymentCapabilities({
    TELEGRAM_BOT_TOKEN: "123456789:real-telegram-token-value",
    TELEGRAM_CHAT_ID: "-1001234567890"
  });
  assert.equal(capabilities.outboundAlerts, true);
});
