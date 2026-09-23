import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeExternalUrl } from "../src/html.js";

test("escapes untrusted HTML before rendering", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("permits HTTPS links and rejects executable or insecure URLs", () => {
  assert.equal(safeExternalUrl("https://arc.etherscan.io/address/0x1"), "https://arc.etherscan.io/address/0x1");
  assert.equal(safeExternalUrl("javascript:alert(1)"), "#");
  assert.equal(safeExternalUrl("http://example.com"), "#");
});
