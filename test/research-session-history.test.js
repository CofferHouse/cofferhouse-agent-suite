import test from "node:test";
import assert from "node:assert/strict";
import { demoMarkets } from "../packages/arc-data/index.js";
import { policyProfiles } from "../packages/policies/index.js";
import { createActionPreview, runResearchSession } from "../packages/agent-modules/index.js";
import { addResearchSessionReceipt, clearResearchSessionHistory, compareResearchSessions, createResearchSessionReceipt, loadResearchSessionHistory, researchSessionFromReceipt, saveResearchSessionHistory } from "../packages/evidence/index.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

function receipt(at, markets = demoMarkets) {
  return createResearchSessionReceipt(runResearchSession({ markets, policy: policyProfiles.balanced, now: () => at }));
}

test("persists only valid Agent Hub receipts and restores their session", () => {
  const storage = memoryStorage();
  const valid = receipt("2026-09-24T12:00:00.000Z");
  const altered = { ...valid, summary: { ...valid.summary, marketsEligible: 999 } };
  assert.equal(saveResearchSessionHistory(storage, [altered, valid]), true);
  const loaded = loadResearchSessionHistory(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].receiptId, valid.receiptId);
  assert.equal(researchSessionFromReceipt(valid).schema, "cofferhouse.agent-hub.session.v1");
});

test("keeps ten unique sessions and clears browser memory", () => {
  const storage = memoryStorage();
  let history = [];
  for (let index = 0; index < 12; index += 1) history = addResearchSessionReceipt(history, receipt(`2026-09-24T12:${String(index).padStart(2, "0")}:00.000Z`));
  assert.equal(history.length, 10);
  saveResearchSessionHistory(storage, history);
  assert.equal(clearResearchSessionHistory(storage).length, 0);
  assert.equal(loadResearchSessionHistory(storage).length, 0);
});

test("compares the decision-relevant summary between sessions", () => {
  const previous = receipt("2026-09-24T12:00:00.000Z");
  const current = receipt("2026-09-24T12:05:00.000Z", demoMarkets.slice(0, 2));
  const comparison = compareResearchSessions(current, previous);
  assert.equal(comparison.changes.marketsObserved, 2 - demoMarkets.length);
  assert.equal(comparison.currentReceiptId, current.receiptId);
});

test("a coordinated receipt can remain the evidence source at the Action Center boundary", () => {
  const source = receipt("2026-09-24T12:00:00.000Z");
  const position = source.outputs.strategy.positions[0];
  assert.ok(position, "the fixture must expose one modeled lending position");
  const preview = createActionPreview({ source: "LENDING", position, sourceReceiptId: source.receiptId });
  assert.equal(preview.sourceReceiptId, source.receiptId);
  assert.equal("calldata" in preview, false);
  assert.ok(preview.missingBeforeExecution.includes("Explicit wallet signature"));
});
