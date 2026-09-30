import test from "node:test";
import assert from "node:assert/strict";
import { runtimeConnectionLabel, shouldRefreshRuntimeStatus } from "../packages/agent-core/index.js";

const now = () => new Date("2026-09-24T12:00:00.000Z");

test("runtime polling refreshes stale visible state only", () => {
  assert.equal(shouldRefreshRuntimeStatus({ lastCheckedAt: null, visibilityState: "visible", now }), true);
  assert.equal(shouldRefreshRuntimeStatus({ lastCheckedAt: "2026-09-24T11:58:00.000Z", visibilityState: "visible", now }), true);
  assert.equal(shouldRefreshRuntimeStatus({ lastCheckedAt: "2026-09-24T11:59:30.000Z", visibilityState: "visible", now }), false);
  assert.equal(shouldRefreshRuntimeStatus({ lastCheckedAt: "2026-09-24T11:00:00.000Z", visibilityState: "hidden", now }), false);
});

test("runtime connection labels distinguish syncing, connected and lost states", () => {
  assert.equal(runtimeConnectionLabel({ mode: "checking" }).status, "SYNCING");
  assert.equal(runtimeConnectionLabel({ mode: "ready", lastCheckedAt: "2026-09-24T12:00:00.000Z" }).status, "CONNECTED");
  const lost = runtimeConnectionLabel({ mode: "unavailable", lastError: "Request timed out." });
  assert.equal(lost.status, "CONNECTION LOST");
  assert.equal(lost.detail, "Request timed out.");
});
