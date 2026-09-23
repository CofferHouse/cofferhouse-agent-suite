import test from "node:test";
import assert from "node:assert/strict";
import { verifyArcMarketContracts } from "../src/arc-rpc.js";

const addresses = {
  loan: "0x1111111111111111111111111111111111111111",
  collateral: "0x2222222222222222222222222222222222222222",
  oracle: "0x3333333333333333333333333333333333333333"
};
const market = { loanAssetAddress: addresses.loan, collateralAssetAddress: addresses.collateral, oracleAddress: addresses.oracle };

test("independently confirms market contract bytecode through Arc RPC", async () => {
  const requested = [];
  const fakeFetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requested.push(request);
    return { ok: true, json: async () => ({ jsonrpc: "2.0", id: request.id, result: "0x60016000" }) };
  };
  const result = await verifyArcMarketContracts([market], "https://rpc.arc.example", fakeFetch);
  assert.equal(result.summary.status, "verified");
  assert.equal(result.summary.contractsChecked, 3);
  assert.equal(result.markets[0].rpcVerification.status, "verified");
  assert.ok(requested.every((request) => request.method === "eth_getCode" && request.params[1] === "latest"));
});

test("records missing bytecode without claiming verification", async () => {
  const fakeFetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ result: request.params[0] === addresses.oracle ? "0x" : "0x6000" }) };
  };
  const result = await verifyArcMarketContracts([market], "https://rpc.arc.example", fakeFetch);
  assert.equal(result.summary.status, "incomplete");
  assert.deepEqual(result.markets[0].rpcVerification.missingCode, [addresses.oracle]);
});

test("rejects insecure RPC configuration", async () => {
  await assert.rejects(() => verifyArcMarketContracts([market], "http://rpc.arc.example"), /secure ARC_RPC_URL/);
});
