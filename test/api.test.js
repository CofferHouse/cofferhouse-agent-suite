import test from "node:test";
import assert from "node:assert/strict";
import healthHandler from "../api/health.js";
import statusHandler from "../api/agent/status.js";
import verifyHandler from "../api/receipt/verify.js";
import { createScoutReceipt } from "../src/receipt.js";
import { scanMarkets } from "../src/agent.js";
import { demoMarkets } from "../src/markets.js";
import { policy } from "../src/policy.js";

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
    await statusHandler({ method: "GET" }, response);
    assert.equal(response.body.configured, false);
    assert.equal(response.body.status, null);
    assert.deepEqual(response.body.history, []);
  } finally {
    if (previousUrl) process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
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
  for (const handler of [healthHandler, statusHandler, verifyHandler]) {
    const response = responseMock();
    await handler({ method: "DELETE", headers: {} }, response);
    assert.equal(response.statusCode, 405);
  }
});
