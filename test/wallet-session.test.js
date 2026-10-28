import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { watchWalletSession } from "../packages/agent-modules/wallet-session.js";

for (const event of ["accountsChanged", "chainChanged", "disconnect"]) {
  test(`invalidates a connected page on ${event} and ignores subsequent events`, () => {
    const provider = new EventEmitter();
    let invalidations = 0;
    watchWalletSession(provider, () => { invalidations += 1; });
    provider.emit(event, event === "accountsChanged" ? [] : "0x1");
    provider.emit("chainChanged", "0x13b2");
    assert.equal(invalidations, 1);
    assert.equal(provider.listenerCount("accountsChanged"), 0);
    assert.equal(provider.listenerCount("chainChanged"), 0);
    assert.equal(provider.listenerCount("disconnect"), 0);
  });
}

test("replacing a subscription removes only its own listeners", () => {
  const provider = new EventEmitter();
  let invalidations = 0;
  const other = () => {};
  provider.on("accountsChanged", other);
  const dispose = watchWalletSession(provider, () => { invalidations += 1; });
  dispose();
  provider.emit("accountsChanged", []);
  assert.equal(invalidations, 0);
  assert.deepEqual(provider.listeners("accountsChanged"), [other]);
});

test("providers without event support remain usable", () => {
  const dispose = watchWalletSession({ request() {} }, () => assert.fail());
  dispose();
});
