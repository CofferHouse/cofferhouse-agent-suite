import { decodeEventLog, parseAbiItem, formatUnits } from "viem";

export const ARC_CCTP_CONTRACTS = Object.freeze({
  tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
});

const depositForBurnV2 = parseAbiItem("event DepositForBurn(address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller, uint256 maxFee, uint32 indexed minFinalityThreshold, bytes hookData)");
const messageReceivedV2 = parseAbiItem("event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)");

const numeric = (value) => Number(BigInt(value));
const order = (a, b) => numeric(b.blockNumber) - numeric(a.blockNumber) || numeric(b.logIndex) - numeric(a.logIndex);

function decode(log, event, direction) {
  try {
    const decoded = decodeEventLog({ abi: [event], data: log.data, topics: log.topics, strict: true });
    const args = decoded.args;
    if (direction === "OUTBOUND") return {
      direction,
      event: "DepositForBurn",
      blockNumber: numeric(log.blockNumber),
      logIndex: numeric(log.logIndex),
      transactionHash: log.transactionHash,
      token: args.burnToken,
      amountAtomic: args.amount.toString(),
      amount: formatUnits(args.amount, 6),
      depositor: args.depositor,
      destinationDomain: Number(args.destinationDomain),
      minimumFinality: Number(args.minFinalityThreshold)
    };
    return {
      direction,
      event: "MessageReceived",
      blockNumber: numeric(log.blockNumber),
      logIndex: numeric(log.logIndex),
      transactionHash: log.transactionHash,
      sourceDomain: Number(args.sourceDomain),
      nonce: args.nonce,
      finalityExecuted: Number(args.finalityThresholdExecuted),
      caller: args.caller
    };
  } catch {
    return null;
  }
}

export function observeArcCctpLogs(logs = [], { fromBlock = null, toBlock = null } = {}) {
  const messenger = ARC_CCTP_CONTRACTS.tokenMessengerV2.toLowerCase();
  const transmitter = ARC_CCTP_CONTRACTS.messageTransmitterV2.toLowerCase();
  const events = logs.map((log) => {
    const address = String(log.address ?? "").toLowerCase();
    if (address === messenger) return decode(log, depositForBurnV2, "OUTBOUND");
    if (address === transmitter) return decode(log, messageReceivedV2, "INBOUND");
    return null;
  }).filter(Boolean).sort(order);
  const outbound = events.filter((event) => event.direction === "OUTBOUND").length;
  const inbound = events.length - outbound;
  return {
    schema: "cofferhouse.interop.observation.v1",
    network: "Arc Mainnet",
    source: "Arc JSON-RPC · CCTP V2 contract logs",
    observedAt: new Date().toISOString(),
    range: { fromBlock, toBlock },
    counts: { total: events.length, outbound, inbound },
    events,
    ordering: "blockNumber DESC, logIndex DESC",
    boundaries: { custody: false, signing: false, execution: false },
    notice: "Observed onchain events are evidence of Arc CCTP activity, not a recommendation or a complete crosschain route quote."
  };
}

const eventIdentity = (event) => `${String(event.transactionHash).toLowerCase()}:${event.logIndex}`;

export function compareArcCctpObservations(previous, current) {
  if (current?.schema !== "cofferhouse.interop.observation.v1") throw new Error("A current Interop observation is required.");
  const previousEvents = previous?.schema === "cofferhouse.interop.observation.v1" ? previous.events : [];
  const known = new Set(previousEvents.map(eventIdentity));
  const newEvents = current.events.filter((event) => !known.has(eventIdentity(event)));
  return {
    schema: "cofferhouse.interop.comparison.v1",
    baselineAvailable: previous?.schema === "cofferhouse.interop.observation.v1",
    previousRange: previous?.range ?? null,
    currentRange: current.range,
    newEvents: newEvents.length,
    newOutbound: newEvents.filter((event) => event.direction === "OUTBOUND").length,
    newInbound: newEvents.filter((event) => event.direction === "INBOUND").length,
    identities: newEvents.map(eventIdentity),
    status: previous?.schema === "cofferhouse.interop.observation.v1" ? (newEvents.length ? "NEW_ACTIVITY" : "NO_NEW_ACTIVITY") : "BASELINE_CREATED"
  };
}

export const interopCapabilityRegistry = Object.freeze([
  Object.freeze({ id: "CCTP", status: "OBSERVABLE", detail: "Read-only Arc burns and received messages from official CCTP V2 contracts." }),
  Object.freeze({ id: "APP_KITS", status: "DOCUMENTED", detail: "Bridge, Swap and Unified Balance are documented by Arc; no wallet adapter is connected here." }),
  Object.freeze({ id: "STABLEFX", status: "DOCUMENTED", detail: "RFQ-to-settlement workflow is mapped, but no StableFX account or API is connected." })
]);

const MAX_BLOCKS = 500;
const MAX_LOGS = 100;

async function rpc(rpcUrl, method, params, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Arc RPC returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message ?? "Arc RPC rejected the observation request.");
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchArcCctpObservation(rpcUrl, { blocks = 250, timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  if (!rpcUrl || !/^https:\/\//i.test(rpcUrl)) throw new Error("A secure ARC_RPC_URL is required.");
  const latestHex = await rpc(rpcUrl, "eth_blockNumber", [], fetchImpl, timeoutMs);
  const latest = Number(BigInt(latestHex));
  const window = Math.max(1, Math.min(MAX_BLOCKS, Number(blocks) || 250));
  const from = Math.max(0, latest - window + 1);
  const logs = await rpc(rpcUrl, "eth_getLogs", [{
    address: [ARC_CCTP_CONTRACTS.tokenMessengerV2, ARC_CCTP_CONTRACTS.messageTransmitterV2],
    fromBlock: `0x${from.toString(16)}`,
    toBlock: latestHex
  }], fetchImpl, timeoutMs);
  return observeArcCctpLogs((logs ?? []).slice(-MAX_LOGS), { fromBlock: from, toBlock: latest });
}
