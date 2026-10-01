import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedReceiptSchema, receiptSchemas, sealDocument, verifyReceiptDocument } from "../packages/evidence/index.js";
test("publishes one receipt registry for every implemented agent artifact", () => {
  assert.equal(receiptSchemas.length, 13); assert.equal(new Set(receiptSchemas).size, receiptSchemas.length);
  assert.equal(isSupportedReceiptSchema("cofferhouse.guardian.receipt.v1"), true);
  assert.equal(isSupportedReceiptSchema("cofferhouse.arc-app-kits.earn-receipt.v1"), true);
});
test("shared receipt verification accepts registered schemas only", () => {
  assert.equal(verifyReceiptDocument(sealDocument({ schema: receiptSchemas[0], value: 1 }, "test")).valid, true);
  assert.equal(verifyReceiptDocument(sealDocument({ schema: "cofferhouse.fake.receipt.v1", value: 1 }, "test")).valid, false);
});
