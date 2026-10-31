import test from "node:test";
import assert from "node:assert/strict";
import { ARC_MAINNET_CHAIN_ID, disconnectedHolderIdentity, normalizeChainId, readHolderIdentity } from "../packages/agent-modules/index.js";

test("normalizes Arc chain identity", () => {
  assert.equal(normalizeChainId("0x13b2"), ARC_MAINNET_CHAIN_ID);
  assert.equal(normalizeChainId("5042"), ARC_MAINNET_CHAIN_ID);
  assert.equal(normalizeChainId("bad"), null);
});

test("rejects malformed or unsafe chain identities instead of accepting a numeric prefix", () => {
  for (const value of ["0x13b2junk", "5042abc", "5042.5", "-5042", -1, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(normalizeChainId(value), null);
  assert.equal(normalizeChainId(" 0X13B2 "), ARC_MAINNET_CHAIN_ID);
});

test("an empty account list never enables the Arc identity gate", async () => {
  const identity = await readHolderIdentity({ request: async ({ method }) => method === "eth_requestAccounts" ? [] : "0x13b2" });
  assert.equal(identity.status, "NO_ACCOUNT");
  assert.equal(identity.isArc, false);
});

test("reads the network after account permission resolves", async () => {
  let authorized = false;
  const identity = await readHolderIdentity({ request: async ({ method }) => {
    if (method === "eth_requestAccounts") {
      await Promise.resolve(); authorized = true;
      return ["0x1111111111111111111111111111111111111111"];
    }
    assert.equal(authorized, true);
    return "0x13b2";
  } });
  assert.equal(identity.isArc, true);
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
