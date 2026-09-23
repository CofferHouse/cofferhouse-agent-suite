import test from "node:test";
import assert from "node:assert/strict";
import { addMonitorObservation, clearMonitorHistory, loadMonitorHistory, saveMonitorHistory } from "../src/history.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  };
}

test("stores and restores monitor observations", () => {
  const storage = memoryStorage();
  const history = addMonitorObservation([], { materialChanges: 1, changes: [{ type: "liquidity" }] }, "2026-09-23T10:00:00.000Z");
  assert.equal(saveMonitorHistory(storage, history), true);
  assert.deepEqual(loadMonitorHistory(storage), history);
});

test("keeps only the ten newest observations", () => {
  let history = [];
  for (let index = 0; index < 12; index += 1) {
    history = addMonitorObservation(history, { materialChanges: index, changes: [] }, `2026-09-23T10:${String(index).padStart(2, "0")}:00.000Z`);
  }
  assert.equal(history.length, 10);
  assert.equal(history[0].materialChanges, 11);
});

test("clears persisted history", () => {
  const storage = memoryStorage();
  saveMonitorHistory(storage, [{ id: "scan-1" }]);
  assert.deepEqual(clearMonitorHistory(storage), []);
  assert.deepEqual(loadMonitorHistory(storage), []);
});
