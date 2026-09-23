import test from "node:test";
import assert from "node:assert/strict";
import { defaultAlertLimits, loadAlertLimits, normalizeAlertLimits, saveAlertLimits } from "../src/alert-limits.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("normalizes invalid alert limits to safe defaults", () => {
  assert.deepEqual(normalizeAlertLimits({ liquidityChangePct: 0, utilizationChangePts: -1 }), defaultAlertLimits);
});

test("persists user-defined alert limits", () => {
  const storage = memoryStorage();
  const saved = saveAlertLimits(storage, { liquidityChangePct: 3, utilizationChangePts: 1.5 });
  assert.deepEqual(saved, { liquidityChangePct: 3, utilizationChangePts: 1.5 });
  assert.deepEqual(loadAlertLimits(storage), saved);
});
