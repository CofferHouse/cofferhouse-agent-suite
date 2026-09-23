import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, sealDocument, sha256Hex, verifySealedDocument } from "../src/integrity.js";

test("SHA-256 matches published standard vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("canonical JSON is independent of object key insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
});

test("sealed documents verify and detect tampering", () => {
  const sealed = sealDocument({ schema: "test.v1", value: 7 }, "test");
  assert.equal(verifySealedDocument(sealed).valid, true);
  assert.equal(verifySealedDocument({ ...sealed, value: 8 }).valid, false);
});

test("sealed documents remain valid after a JSON download round trip", () => {
  const sealed = sealDocument({ schema: "test.v1", omitted: undefined, list: [1, undefined, 3] }, "test");
  const downloaded = JSON.parse(JSON.stringify(sealed));
  assert.equal(verifySealedDocument(downloaded).valid, true);
  assert.equal(canonicalJson({ kept: 1, omitted: undefined }), canonicalJson({ kept: 1 }));
});
