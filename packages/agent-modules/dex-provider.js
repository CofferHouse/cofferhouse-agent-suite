import { normalizeDexPair } from "./dex-pools.js";

const ARC_CHAIN_IDS = new Set(["arc", "5042"]);

export function normalizeDexScreenerResponse(payload, selection = null) {
  if (!payload || !Array.isArray(payload.pairs)) throw new Error("DEX provider returned an invalid response.");
  return payload.pairs
    .filter((pair) => ARC_CHAIN_IDS.has(String(pair.chainId).toLowerCase()))
    .map((pair) => normalizeDexPair(pair, selection))
    .sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
}

export async function fetchArcPoolsForToken(address, selection = null, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/dex/pools?token=${encodeURIComponent(address)}`, { headers: { Accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `DEX pool request failed (${response.status}).`);
  return normalizeDexScreenerResponse({ pairs: payload.pools }, selection);
}
