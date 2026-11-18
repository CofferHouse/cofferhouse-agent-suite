import { isSolanaPublicKey } from "../arc-data/jupiter-lend.js";
import { verifySealedDocument } from "../evidence/integrity.js";

export const MAX_POSITION_RECEIPT_BYTES = 32768;
const metrics = ["providerPnlUsd", "providerAllTimeFeesUsd", "providerDepositsUsd", "providerWithdrawalsUsd"];
const scale = 10n ** 18n;
function decimal(value, signed = false) {
  if (value === null) return null;
  if (typeof value !== "string" || !(signed ? /^-?\d{1,32}(\.\d{1,18})?$/ : /^\d{1,32}(\.\d{1,18})?$/).test(value)) throw Error("INVALID_OBSERVATION");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const units = BigInt(whole) * scale + BigInt(fraction.padEnd(18, "0"));
  return negative ? -units : units;
}
function text(units) {
  if (units === null) return null;
  const sign = units < 0n ? "-" : "", absolute = units < 0n ? -units : units;
  const fraction = String(absolute % scale).padStart(18, "0").replace(/0+$/, "");
  return `${sign}${absolute / scale}${fraction ? `.${fraction}` : ""}`;
}
function validate(observation) {
  if (observation?.schema !== "cofferhouse.meteora.position-observation.v1" || observation.source !== "Meteora DLMM Data API" || observation.onchainVerified !== false || observation.tokenAmountUnitsVerified !== false) throw Error("INVALID_OBSERVATION");
  if (![observation.pool, observation.position, observation.queriedUser, observation.tokenX?.mint, observation.tokenY?.mint].every(isSolanaPublicKey) || observation.pool === observation.position || observation.tokenX.mint === observation.tokenY.mint) throw Error("IDENTITY_UNCONFIRMED");
  if (observation.id !== `solana:mainnet:meteora-dlmm:${observation.pool}:${observation.position}`) throw Error("IDENTITY_UNCONFIRMED");
  const time = typeof observation.observedAt === "string" ? Date.parse(observation.observedAt) : NaN;
  if (!Number.isFinite(time) || new Date(time).toISOString() !== observation.observedAt) throw Error("INVALID_OBSERVATION");
  const range = observation.range;
  const bin = n => n === null || Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
  if (!range || !["IN_RANGE", "OUT_OF_RANGE", "UNKNOWN", "CLOSED"].includes(range.state) || ![range.lowerBinId, range.activeBinId, range.upperBinId].every(bin)) throw Error("INVALID_OBSERVATION");
  if (range.state === "CLOSED" && range.isClosed !== true) throw Error("INVALID_OBSERVATION");
  if (["IN_RANGE", "OUT_OF_RANGE"].includes(range.state)) {
    if (range.isClosed !== false || [range.lowerBinId, range.activeBinId, range.upperBinId].some(n => n === null) || range.lowerBinId > range.upperBinId) throw Error("INVALID_OBSERVATION");
    const outside = range.activeBinId < range.lowerBinId || range.activeBinId > range.upperBinId;
    if (outside !== (range.state === "OUT_OF_RANGE") || typeof range.providerOutOfRange === "boolean" && range.providerOutOfRange !== outside) throw Error("INVALID_OBSERVATION");
  }
  return { time, values: Object.fromEntries(metrics.map(name => [name, decimal(observation[name], name === "providerPnlUsd")])) };
}

export function readMeteoraPositionReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || receipt.schema !== "cofferhouse.meteora.position-receipt.v1") throw Error("INVALID_RECEIPT");
  const serialized = JSON.stringify(receipt);
  if (new TextEncoder().encode(serialized).length > MAX_POSITION_RECEIPT_BYTES) throw Error("INVALID_RECEIPT");
  try { if (!verifySealedDocument(receipt).valid) throw Error(); }
  catch { throw Error("INVALID_RECEIPT"); }
  validate(receipt.observation);
  const generated = typeof receipt.generatedAt === "string" ? Date.parse(receipt.generatedAt) : NaN;
  if (!Number.isFinite(generated) || new Date(generated).toISOString() !== receipt.generatedAt) throw Error("INVALID_RECEIPT");
  return receipt.observation;
}

export function compareMeteoraPositionReceipts(beforeReceipt, afterReceipt) {
  const before = readMeteoraPositionReceipt(beforeReceipt), after = readMeteoraPositionReceipt(afterReceipt);
  const a = validate(before), b = validate(after);
  if (["id", "pool", "position", "queriedUser"].some(key => before[key] !== after[key]) || ["tokenX", "tokenY"].some(key => before[key].mint !== after[key].mint)) throw Error("POSITION_MISMATCH");
  if (b.time <= a.time) throw Error("OBSERVATIONS_NOT_ORDERED");
  const differences = Object.fromEntries(metrics.map(name => [name, a.values[name] === null || b.values[name] === null ? null : b.values[name] - a.values[name]]));
  const warnings = ["INDEXED_DATA_NOT_AUTHENTICATED", "COSTS_AND_HOLDING_NOT_RECONCILED"];
  const deposits = differences.providerDepositsUsd, withdrawals = differences.providerWithdrawalsUsd;
  const counters = [deposits, withdrawals, differences.providerAllTimeFeesUsd];
  if (counters.some(value => value !== null && value < 0n)) warnings.push("PROVIDER_COUNTER_DECREASED");
  if (metrics.some(name => differences[name] === null)) warnings.push("METRICS_UNKNOWN");
  const capitalFlowState = [deposits, withdrawals].some(v => v !== null && v < 0n) ? "COUNTER_DECREASED" : deposits === null || withdrawals === null ? "UNKNOWN" : deposits === 0n && withdrawals === 0n ? "NO_CHANGE_OBSERVED" : "CHANGED";
  if (capitalFlowState === "CHANGED") warnings.push("CAPITAL_FLOWS_CHANGED");
  const boundsKnown = [before.range.lowerBinId, before.range.upperBinId, after.range.lowerBinId, after.range.upperBinId].every(n => n !== null);
  const boundsChanged = boundsKnown ? before.range.lowerBinId !== after.range.lowerBinId || before.range.upperBinId !== after.range.upperBinId : null;
  if (boundsChanged) warnings.push("POSITION_RANGE_CHANGED");
  if (boundsChanged === null || before.range.state === "UNKNOWN" || after.range.state === "UNKNOWN") warnings.push("RANGE_UNCONFIRMED");
  if (after.range.state === "OUT_OF_RANGE") warnings.push("POSITION_OUT_OF_RANGE");
  if (after.range.state === "CLOSED") warnings.push("PROVIDER_REPORTS_CLOSED");
  return {
    schema: "cofferhouse.meteora.position-comparison.v1",
    positionId: before.id, pool: before.pool, position: before.position, queriedUser: before.queriedUser,
    tokenMints: { x: before.tokenX.mint, y: before.tokenY.mint },
    beforeReceiptId: beforeReceipt.receiptId, afterReceiptId: afterReceipt.receiptId,
    beforeObservedAt: before.observedAt, afterObservedAt: after.observedAt, elapsedSeconds: (b.time - a.time) / 1000,
    providerChangesUsd: Object.fromEntries(metrics.map(name => [name, text(differences[name])])),
    capitalFlowState, netDepositsMinusWithdrawalsUsd: ["CHANGED", "NO_CHANGE_OBSERVED"].includes(capitalFlowState) ? text(deposits - withdrawals) : null,
    range: { before: before.range.state, after: after.range.state, boundsChanged }, warnings,
    costAdjustedPnlUsd: null, holdingBenchmarkUsd: null, netReturnPct: null, realizedProfitUsd: null,
    sourceAuthenticated: false, execution: { enabled: false, signed: false, submitted: false },
    notice: "Differences between two indexed observations, not investment returns. Receipt hashes check integrity, not source authenticity. Provider PnL and lifetime fee changes are not added. Counter values and USD valuations may be corrected or repriced by the provider; no transaction history, costs or holding benchmark is reconciled."
  };
}
