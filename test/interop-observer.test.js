import test from "node:test";
import assert from "node:assert/strict";
import { encodeEventTopics, encodeAbiParameters, parseAbiParameters } from "viem";
import { ARC_CCTP_CONTRACTS, compareArcCctpObservations, fetchArcCctpObservation, interopCapabilityRegistry, observeArcCctpLogs } from "../packages/agent-modules/index.js";
import { createInteropReceipt, verifyReceiptDocument } from "../packages/evidence/index.js";

const depositEvent = { type: "event", name: "DepositForBurn", inputs: [
  { name: "burnToken", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false },
  { name: "depositor", type: "address", indexed: true }, { name: "mintRecipient", type: "bytes32", indexed: false },
  { name: "destinationDomain", type: "uint32", indexed: false }, { name: "destinationTokenMessenger", type: "bytes32", indexed: false },
  { name: "destinationCaller", type: "bytes32", indexed: false }, { name: "maxFee", type: "uint256", indexed: false },
  { name: "minFinalityThreshold", type: "uint32", indexed: true }, { name: "hookData", type: "bytes", indexed: false }
] };

test("interop observer decodes and canonically orders CCTP V2 activity", () => {
  const zero = `0x${"0".repeat(64)}`;
  const token = "0x3600000000000000000000000000000000000000";
  const depositor = "0x1111111111111111111111111111111111111111";
  const topics = encodeEventTopics({ abi: [depositEvent], eventName: "DepositForBurn", args: { burnToken: token, depositor, minFinalityThreshold: 2000 } });
  const data = encodeAbiParameters(parseAbiParameters("uint256, bytes32, uint32, bytes32, bytes32, uint256, bytes"), [1000000n, zero, 6, zero, zero, 100n, "0x"]);
  const result = observeArcCctpLogs([{ address: ARC_CCTP_CONTRACTS.tokenMessengerV2, blockNumber: "0xa", logIndex: "0x2", transactionHash: `0x${"1".repeat(64)}`, topics, data }], { fromBlock: 1, toBlock: 10 });
  assert.deepEqual(result.counts, { total: 1, outbound: 1, inbound: 0 });
  assert.equal(result.events[0].amount, "1");
  assert.equal(result.events[0].destinationDomain, 6);
  assert.equal(result.events[0].minimumFinality, 2000);
  assert.deepEqual(result.boundaries, { custody: false, signing: false, execution: false });
});

test("interop capability registry distinguishes observation from future connections", () => {
  assert.deepEqual(interopCapabilityRegistry.map((item) => item.status), ["OBSERVABLE", "DOCUMENTED", "DOCUMENTED"]);
});

test("interop observation creates a tamper-evident non-execution receipt", () => {
  const observation = observeArcCctpLogs([], { fromBlock: 20, toBlock: 30 });
  const receipt = createInteropReceipt(observation);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
  assert.deepEqual(receipt.execution, { bridge: false, swap: false, settlement: false, transactionSubmitted: false });
});

test("bounded Interop RPC adapter requests the latest capped block window", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    return { ok: true, json: async () => ({ jsonrpc: "2.0", id: body.id, result: body.method === "eth_blockNumber" ? "0x3e8" : [] }) };
  };
  const observation = await fetchArcCctpObservation("https://rpc.example", { blocks: 9_999, fetchImpl });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "eth_getLogs");
  assert.equal(calls[1].params[0].fromBlock, "0x1f5");
  assert.equal(calls[1].params[0].toBlock, "0x3e8");
  assert.deepEqual(calls[1].params[0].address, [ARC_CCTP_CONTRACTS.tokenMessengerV2, ARC_CCTP_CONTRACTS.messageTransmitterV2]);
  assert.deepEqual(observation.counts, { total: 0, outbound: 0, inbound: 0 });
});

test("Interop RPC adapter rejects insecure endpoints", async () => {
  await assert.rejects(() => fetchArcCctpObservation("http://rpc.example"), /secure ARC_RPC_URL/);
});

test("Interop comparison removes overlap and reports only newly observed events", () => {
  const event = { direction: "INBOUND", transactionHash: `0x${"a".repeat(64)}`, logIndex: 1 };
  const next = { direction: "OUTBOUND", transactionHash: `0x${"b".repeat(64)}`, logIndex: 2 };
  const previous = { schema: "cofferhouse.interop.observation.v1", range: { fromBlock: 1, toBlock: 10 }, events: [event] };
  const current = { schema: "cofferhouse.interop.observation.v1", range: { fromBlock: 6, toBlock: 15 }, events: [event, next] };
  const result = compareArcCctpObservations(previous, current);
  assert.equal(result.status, "NEW_ACTIVITY");
  assert.equal(result.newEvents, 1);
  assert.equal(result.newOutbound, 1);
  assert.equal(result.newInbound, 0);
});
