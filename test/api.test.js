import test from "node:test";
import assert from "node:assert/strict";
import healthHandler from "../api/health.js";
import statusHandler, { isDetailedStatusAuthorized } from "../api/agent/status.js";
import verifyHandler from "../api/receipt/verify.js";
import dexPoolHandler from "../api/dex/pools.js";
import dexQuoteHandler from "../api/dex/quote.js";
import guardianWatchHandler from "../api/guardian/watch.js";
import interopObserveHandler from "../api/interop/observe.js";
import onrampHandler, { onrampReadiness } from "../api/app-kits/onramp.js";
import borrowHandler from "../api/app-kits/borrow.js";
import { createScoutReceipt } from "../packages/evidence/index.js";
import { scanMarkets } from "../packages/agent-core/index.js";
import { demoMarkets } from "../packages/arc-data/index.js";
import { policy } from "../packages/policies/index.js";

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("health endpoint exposes readiness without secrets", async () => {
  const response = responseMock();
  await healthHandler({ method: "GET" }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.mode, "read-only");
  assert.equal("CRON_SECRET" in response.body, false);
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("status endpoint reports unconfigured durable storage safely", async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const response = responseMock();
    await statusHandler({ method: "GET", headers: {} }, response);
    assert.equal(response.body.configured, false);
    assert.equal(response.body.access, "public_summary");
    assert.equal(response.body.capabilities, undefined);
    assert.equal(response.body.status, null);
    assert.deepEqual(response.body.history, []);
    assert.equal(response.body.researchSession, null);
    assert.deepEqual(response.body.researchSessions, []);
    assert.equal(response.body.interop, null);
    assert.deepEqual(response.body.interopHistory, []);
  } finally {
    if (previousUrl) process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test("durable status detail requires the exact operator bearer token", () => {
  assert.equal(isDetailedStatusAuthorized({ headers: {} }, "operator-secret"), false);
  assert.equal(isDetailedStatusAuthorized({ headers: { authorization: "Bearer wrong" } }, "operator-secret"), false);
  assert.equal(isDetailedStatusAuthorized({ headers: { authorization: "Bearer operator-secret" } }, "operator-secret"), true);
});

test("receipt API verifies supported files and rejects altered content", async () => {
  const receipt = createScoutReceipt(scanMarkets(demoMarkets), policy);
  const validResponse = responseMock();
  await verifyHandler({ method: "POST", headers: {}, body: receipt }, validResponse);
  assert.equal(validResponse.statusCode, 200);
  assert.equal(validResponse.body.valid, true);

  const alteredResponse = responseMock();
  await verifyHandler({ method: "POST", headers: {}, body: { ...receipt, notice: "changed" } }, alteredResponse);
  assert.equal(alteredResponse.statusCode, 422);
  assert.equal(alteredResponse.body.valid, false);
});

test("public endpoints reject unsupported methods", async () => {
  for (const handler of [healthHandler, statusHandler, verifyHandler, dexPoolHandler, dexQuoteHandler, interopObserveHandler, onrampHandler, borrowHandler]) {
    const response = responseMock();
    await handler({ method: "DELETE", headers: {} }, response);
    assert.equal(response.statusCode, 405);
  }
  const guardianResponse = responseMock();
  await guardianWatchHandler({ method: "PATCH", headers: {} }, guardianResponse);
  assert.equal(guardianResponse.statusCode, 405);
});

test("Onramp readiness exposes gates without returning secrets", async () => {
  const readiness = onrampReadiness({ CIRCLE_API_KEY: "circle-live-key", SCOUT_OPERATOR_TOKEN: "operator-token-long-enough", ONRAMP_REFERRER_DOMAIN: "cofferhouse-scout.vercel.app" });
  assert.equal(readiness.configured, true);
  assert.equal(readiness.sessionTtlMinutes, 30);
  assert.equal("apiKey" in readiness, false);
  const response = responseMock();
  await onrampHandler({ method: "GET", headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, "Circle Arc Onramp Kit");
  assert.equal("CIRCLE_API_KEY" in response.body, false);
});

test("Onramp session creation is protected before any upstream request", async () => {
  const response = responseMock();
  await onrampHandler({ method: "POST", headers: {}, body: { destinationAddress: "0x1111111111111111111111111111111111111111", amount: "100" } }, response);
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, /authorization/i);
});

test("Interop observation fails visibly when Arc RPC is not configured", async () => {
  const previous = process.env.ARC_RPC_URL;
  delete process.env.ARC_RPC_URL;
  try {
    const response = responseMock();
    await interopObserveHandler({ method: "GET", query: {} }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.configured, false);
    assert.match(response.body.error, /not configured/i);
  } finally {
    if (previous) process.env.ARC_RPC_URL = previous;
  }
});

test("durable Guardian registration is protected", async () => {
  const response = responseMock();
  await guardianWatchHandler({ method: "POST", headers: {}, body: {} }, response);
  assert.equal(response.statusCode, 401);
});

test("DEX quote endpoint fails safely without a server-side API key", async () => {
  const previous = process.env.UNISWAP_API_KEY;
  delete process.env.UNISWAP_API_KEY;
  try {
    const response = responseMock();
    await dexQuoteHandler({ method: "POST", body: { tokenOut: "0x1111111111111111111111111111111111111111", amountUsd: 100 } }, response);
    assert.equal(response.statusCode, 503);
    assert.match(response.body.error, /not configured/);
  } finally {
    if (previous) process.env.UNISWAP_API_KEY = previous;
  }
});

test("DEX pool endpoint requires a complete contract address", async () => {
  const response = responseMock();
  await dexPoolHandler({ method: "GET", query: { token: "USDC" } }, response);
  assert.equal(response.statusCode, 400);
});
