import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDeploymentReadiness } from "../packages/agent-core/index.js";

const now = () => new Date("2026-09-24T12:00:00.000Z");

test("deployment readiness lists missing required services without exposing values", () => {
  const result = evaluateDeploymentReadiness({ capabilities: {}, now });
  assert.equal(result.status, "SETUP_REQUIRED");
  assert.deepEqual(result.missingRequired, ["durable-memory", "protected-scheduler"]);
  assert.equal(result.readyForUnattendedCycles, false);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("CRON_SECRET"), false);
  assert.equal(serialized.includes("UPSTASH_REDIS_REST_TOKEN"), false);
  assert.equal(serialized.includes("UPSTASH_REDIS_REST_URL"), false);
});

test("configured deployment waits for its first protected cycle", () => {
  const result = evaluateDeploymentReadiness({ capabilities: { durableMemory: true, protectedScheduler: true }, now });
  assert.equal(result.status, "READY_FOR_FIRST_RUN");
  assert.equal(result.readyForUnattendedCycles, true);
  assert.equal(result.healthy, false);
});

test("recent protected cycles are operational and stale cycles degrade", () => {
  const capabilities = { durableMemory: true, protectedScheduler: true };
  const recent = evaluateDeploymentReadiness({ capabilities, lastRunAt: "2026-09-24T11:50:00.000Z", now });
  const stale = evaluateDeploymentReadiness({ capabilities, lastRunAt: "2026-09-24T10:00:00.000Z", now });
  assert.equal(recent.status, "OPERATIONAL");
  assert.equal(recent.ageMinutes, 10);
  assert.equal(stale.status, "DEGRADED_STALE");
  assert.equal(stale.healthy, false);
});
