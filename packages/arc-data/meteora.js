import { isSolanaPublicKey } from "./jupiter-lend.js";

export const METEORA_SAMPLE_LIMIT = 20;
const metric = value => (typeof value === "number" || typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= Number.MAX_SAFE_INTEGER ? Number(value) : null;
const flag = value => typeof value === "boolean" ? value : null;

export function normalizeMeteoraPools(payload, observedAt = new Date().toISOString()) {
  if (!Array.isArray(payload?.data) || payload.data.length > METEORA_SAMPLE_LIMIT || payload.current_page !== 1 || !Number.isFinite(Date.parse(observedAt))) throw Error("Invalid Meteora page");
  const seen = new Set();
  const token = value => {
    if (!isSolanaPublicKey(value?.address) || typeof value.symbol !== "string" || !value.symbol.length || value.symbol.length > 40) throw Error("Invalid Meteora token");
    return { mint: value.address, symbol: value.symbol, providerVerified: flag(value.is_verified), freezeAuthorityDisabled: flag(value.freeze_authority_disabled) };
  };
  return payload.data.map(row => {
    if (!isSolanaPublicKey(row?.address) || seen.has(row.address)) throw Error("Invalid Meteora pool identity");
    seen.add(row.address);
    const tokenX = token(row.token_x), tokenY = token(row.token_y);
    if (tokenX.mint === tokenY.mint) throw Error("Duplicate pool mints");
    return {
      id: `solana:mainnet:meteora-dlmm:${row.address}`, address: row.address,
      network: "Solana mainnet", protocol: "Meteora DLMM", observedAt,
      tokenX, tokenY, tvlUsd: metric(row.tvl), volume24hUsd: metric(row.volume?.["24h"]),
      poolFees24hUsd: metric(row.fees?.["24h"]), providerBlacklisted: flag(row.is_blacklisted),
      positionPnlUsd: null, netReturnPct: null, tokenSecurityVerified: false
    };
  });
}

export async function fetchMeteoraPools({ fetcher = globalThis.fetch, timeoutMs = 10000 } = {}) {
  try {
    const response = await fetcher(`https://dlmm.datapi.meteora.ag/pools?page=1&page_size=${METEORA_SAMPLE_LIMIT}&sort_by=tvl%3Adesc`, {
      method: "GET", redirect: "error", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw Error("Meteora unavailable");
    const pools = normalizeMeteoraPools(await response.json());
    return { status: pools.length ? "FOUND" : "NO_MATCH", pools, sampled: pools.length, source: "Meteora DLMM Data API", sampling: "First page, up to 20 pools ordered by TVL; not exhaustive." };
  } catch {
    return { status: "UNAVAILABLE", pools: [], sampled: null, source: "Meteora DLMM Data API" };
  }
}
