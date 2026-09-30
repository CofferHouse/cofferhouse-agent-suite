import test from "node:test";
import assert from "node:assert/strict";
import { ARC_MAINNET_CHAIN_ID, disconnectedHolderIdentity, normalizeChainId, readHolderIdentity } from "../packages/agent-modules/index.js";

test("normalizes Arc chain identity", () => {
  assert.equal(normalizeChainId("0x13b2"), ARC_MAINNET_CHAIN_ID);
  assert.equal(normalizeChainId("5042"), ARC_MAINNET_CHAIN_ID);
  assert.equal(normalizeChainId("bad"), null);
});

test("reads an Arc wallet without requesting signatures", async () => {
  const methods = [];
  const identity = await readHolderIdentity({ request: async ({ method }) => {
    methods.push(method);
    return method === "eth_requestAccounts" ? ["0x1111111111111111111111111111111111111111"] : "0x13b2";
  } });
  assert.equal(identity.status, "CONNECTED");
  assert.equal(identity.isArc, true);
  assert.deepEqual(methods.sort(), ["eth_chainId", "eth_requestAccounts"]);
});

test("fails visibly when wallet is absent or on another chain", async () => {
  assert.equal(disconnectedHolderIdentity(false).status, "NO_PROVIDER");
  const identity = await readHolderIdentity({ request: async ({ method }) => method === "eth_requestAccounts" ? ["0x2222222222222222222222222222222222222222"] : "0x1" });
  assert.equal(identity.status, "WRONG_NETWORK");
  assert.equal(identity.isArc, false);
});
