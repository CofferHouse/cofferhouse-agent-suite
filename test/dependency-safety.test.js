import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
// Resolve through the actual SDK dependency, rather than an unrelated root copy.
const anchorRequire = createRequire(require.resolve("@coral-xyz/anchor"));
const toml = anchorRequire("toml");

test("Anchor configuration still accepts Buffer input with the patched TOML parser", () => {
  assert.equal(anchorRequire("toml/package.json").version, "4.2.0");
  const config = toml.parse(Buffer.from('[provider]\ncluster = "localnet"\nwallet = "test.json"\n[programs.localnet]\ncoffer = "test-program"'));
  assert.equal(config.provider.cluster, "localnet");
  assert.equal(config.programs.localnet.coffer, "test-program");
});

test("deep untrusted TOML is rejected before a JavaScript stack overflow", () => {
  assert.throws(() => toml.parse("a=" + "[".repeat(3000) + "1" + "]".repeat(3000)), error => !(error instanceof RangeError) && /nesting depth/i.test(error.message));
  assert.equal(toml.parse('name="still working"').name, "still working");
});

test("TOML prototype keys cannot modify shared object prototypes", () => {
  assert.equal(Object.prototype.cofferDependencyPolluted, undefined);
  try { toml.parse('__proto__.cofferDependencyPolluted = "unexpected"'); } catch {}
  assert.equal(Object.prototype.cofferDependencyPolluted, undefined);
  assert.equal({}.cofferDependencyPolluted, undefined);
});

test("server SDK route handlers load after the dependency update", async () => {
  for (const path of ["../server/app-kits/borrow.js", "../server/app-kits/earn.js", "../server/app-kits/onramp.js"]) {
    const module = await import(path);
    assert.equal(typeof module.default, "function");
  }
});
