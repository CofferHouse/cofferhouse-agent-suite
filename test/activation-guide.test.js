import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDeploymentReadiness, ownerActivationStep } from "../packages/agent-core/index.js";

const now = () => new Date("2026-10-07T12:00:00.000Z");

test("owner activation starts with Upstash and never exposes secret values", () => {
  const deployment = evaluateDeploymentReadiness({ capabilities: {}, now });
  const result = ownerActivationStep(deployment, {});
  assert.equal(result.id, "CONNECT_UPSTASH");
  assert.equal(result.order, 1);
  assert.equal(result.secretsInResponse, false);
  assert.equal(JSON.stringify(result).includes("replace-with"), false);
});

test("owner activation advances one verified step at a time", () => {
  const memoryOnly = evaluateDeploymentReadiness({ capabilities: { durableMemory: true }, now });
  assert.equal(ownerActivationStep(memoryOnly, { durableMemory: true }).id, "ADD_CRON_SECRET");

  const ready = evaluateDeploymentReadiness({ capabilities: { durableMemory: true, protectedScheduler: true }, now });
  assert.equal(ownerActivationStep(ready, { durableMemory: true, protectedScheduler: true }).id, "RUN_FIRST_CYCLE");

  const operational = evaluateDeploymentReadiness({ capabilities: { durableMemory: true, protectedScheduler: true }, lastRunAt: "2026-10-07T11:55:00.000Z", now });
  assert.equal(ownerActivationStep(operational, { durableMemory: true, protectedScheduler: true }).id, "ADD_ARC_RPC");
  assert.equal(ownerActivationStep(operational, { durableMemory: true, protectedScheduler: true, arcRpcVerification: true }).id, "ADD_OPERATOR_TOKEN");
  assert.equal(ownerActivationStep(operational, { durableMemory: true, protectedScheduler: true, arcRpcVerification: true, humanAcknowledgment: true }).id, "CORE_ACTIVATION_COMPLETE");
});

test("owner activation exposes safe recovery instead of asking for deletion", () => {
  const degraded = evaluateDeploymentReadiness({ capabilities: { durableMemory: true, protectedScheduler: true }, lastRunAt: "2026-10-07T09:00:00.000Z", now });
  const result = ownerActivationStep(degraded, { durableMemory: true, protectedScheduler: true });
  assert.equal(result.id, "RECOVER_CYCLE");
  assert.match(result.action, /Do not delete/);
});

