import test from "node:test";
import assert from "node:assert/strict";
import { createAcknowledgment } from "../src/acknowledgment.js";

test("creates an auditable operator acknowledgment", () => {
  const result = createAcknowledgment({ fingerprint: "alert-deadbeef", operator: "Risk operator", note: "Reviewed source data.", now: () => new Date("2026-09-23T14:00:00.000Z") });
  assert.equal(result.operator, "Risk operator");
  assert.equal(result.acknowledgedAt, "2026-09-23T14:00:00.000Z");
});

test("rejects malformed or anonymous acknowledgments", () => {
  assert.throws(() => createAcknowledgment({ fingerprint: "bad", operator: "x" }), /fingerprint/);
  assert.throws(() => createAcknowledgment({ fingerprint: "alert-deadbeef", operator: "" }), /Operator/);
});
