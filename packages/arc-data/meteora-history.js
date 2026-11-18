import { isSolanaPublicKey } from "./jupiter-lend.js";
import { validMeteoraPositionTarget } from "./meteora-position.js";
import { decimalUnits } from "../shared/decimal-usd.js";

export const METEORA_HISTORY_LIMIT = 200;
export const METEORA_HISTORY_SOURCE = "Meteora DLMM Data API";
const types = new Set(["add", "remove", "claim_fee", "claim_reward"]);
export function isSolanaSignature(value) {
  if (typeof value !== "string" || value.length < 64 || value.length > 88) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const char of value) { const digit = alphabet.indexOf(char); if (digit < 0) return false; n = n * 58n + BigInt(digit); }
  let bytes = value.match(/^1*/)[0].length;
  while (n) { bytes++; n >>= 8n; }
  return bytes === 64;
}
const unsignedInt = value => Number.isSafeInteger(value) && value >= 0;
const rawDecimal = value => decimalUnits(value) === null ? null : value;
export function normalizeMeteoraHistory(payload, target, observedAt = new Date().toISOString()) {
  if (!validMeteoraPositionTarget(target) || typeof observedAt !== "string" || !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt || !Array.isArray(payload?.events)) throw Error("INVALID_HISTORY");
  if (payload.events.length > METEORA_HISTORY_LIMIT) throw Error("HISTORY_LIMIT_EXCEEDED");
  const seen = new Map(), warnings = new Set();
  let duplicatesCollapsed = 0;
  for (const row of payload.events) {
    if (!row || row.poolAddress !== target.pool || row.positionAddress !== target.position || ![row.userAddress, row.tokenX, row.tokenY].every(isSolanaPublicKey) || row.tokenX === row.tokenY || !isSolanaSignature(row.signature) || !unsignedInt(row.ixIndex) || !unsignedInt(row.slot) || !unsignedInt(row.blockTime) || !Number.isFinite(new Date(row.blockTime * 1000).getTime()) || typeof row.eventType !== "string" || !row.eventType.length || row.eventType.length > 40 || typeof row.createdAt !== "string" || row.createdAt.length > 40 || !Number.isFinite(Date.parse(row.createdAt))) throw Error("INVALID_HISTORY");
    const type = types.has(row.eventType) ? row.eventType : "UNKNOWN";
    const x = decimalUnits(row.amountXUsd), y = decimalUnits(row.amountYUsd), total = decimalUnits(row.totalUsd);
    const valueKnown = x !== null && y !== null && total !== null && x + y === total;
    const eventWarnings = [];
    if (type === "UNKNOWN") eventWarnings.push("UNKNOWN_EVENT_TYPE");
    if (!valueKnown) eventWarnings.push("USD_VALUE_UNCONFIRMED");
    if (row.userAddress !== target.user) eventWarnings.push("DIFFERENT_EVENT_ACTOR");
    if (type === "claim_reward") eventWarnings.push("REWARD_SEMANTICS_UNVERIFIED");
    eventWarnings.forEach(w => warnings.add(w));
    const event = {
      eventId: `${row.signature}:${row.ixIndex}:${row.eventType}`, signature: row.signature, ixIndex: row.ixIndex, eventType: row.eventType, type,
      positionAddress: row.positionAddress, poolAddress: row.poolAddress, userAddress: row.userAddress, tokenX: row.tokenX, tokenY: row.tokenY,
      slot: row.slot, blockTime: row.blockTime, createdAt: new Date(row.createdAt).toISOString(),
      amountX: rawDecimal(row.amountX), amountY: rawDecimal(row.amountY), amountXUsd: rawDecimal(row.amountXUsd), amountYUsd: rawDecimal(row.amountYUsd), totalUsd: rawDecimal(row.totalUsd),
      indexedValueUsd: valueKnown && type !== "UNKNOWN" ? row.totalUsd : null, warnings: eventWarnings
    };
    const previous = seen.get(event.eventId);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event)) throw Error("CONFLICTING_HISTORY_EVENT");
      duplicatesCollapsed++; warnings.add("DUPLICATE_EVENTS_COLLAPSED");
    } else seen.set(event.eventId, event);
  }
  const events = [...seen.values()].sort((a, b) => a.blockTime - b.blockTime || a.slot - b.slot || a.signature.localeCompare(b.signature) || a.ixIndex - b.ixIndex || a.eventType.localeCompare(b.eventType));
  return {
    schema: "cofferhouse.meteora.history-observation.v1", status: events.length ? "FOUND" : "NOT_OBSERVED",
    target: { pool: target.pool, user: target.user, position: target.position }, observedAt: new Date(observedAt).toISOString(),
    source: METEORA_HISTORY_SOURCE, onchainVerified: false, tokenAmountUnitsVerified: false, coverage: "UNVERIFIED",
    maxEvents: METEORA_HISTORY_LIMIT, receivedEvents: payload.events.length, duplicatesCollapsed, events, warnings: [...warnings],
    notice: "Indexed event sample, not verified complete history. Provider USD values and event categories are not independently reconciled. Network fees, tips, rent and ownership verification are absent."
  };
}
async function boundedHistoryJson(response) {
  const limit = 262144;
  if (Number(response.headers?.get?.("content-length")) > limit) throw Error("HISTORY_LIMIT_EXCEEDED");
  if (response.body?.getReader) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = "", bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > limit) { await reader.cancel(); throw Error("HISTORY_LIMIT_EXCEEDED"); }
        text += decoder.decode(part.value, { stream: true });
      }
      return JSON.parse(text + decoder.decode());
    } finally { reader.releaseLock(); }
  }
  // Test adapters may expose only json(); production Fetch responses use the bounded stream.
  return response.json();
}
export async function fetchMeteoraHistory(target, { fetcher = globalThis.fetch, timeoutMs = 10000 } = {}) {
  if (!validMeteoraPositionTarget(target)) throw Error("Invalid history target");
  try {
    const response = await fetcher(`https://dlmm.datapi.meteora.ag/positions/${target.position}/historical?order_direction=asc`, { method: "GET", redirect: "error", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw Error("Unavailable");
    return normalizeMeteoraHistory(await boundedHistoryJson(response), target);
  } catch (error) {
    return { status: error?.message === "HISTORY_LIMIT_EXCEEDED" ? "LIMIT_EXCEEDED" : "UNAVAILABLE", target: { pool: target.pool, user: target.user, position: target.position }, observedAt: null, source: METEORA_HISTORY_SOURCE, onchainVerified: false, coverage: "UNVERIFIED", maxEvents: METEORA_HISTORY_LIMIT, events: [] };
  }
}
