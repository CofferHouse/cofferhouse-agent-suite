import { isSolanaPublicKey } from "./jupiter-lend.js";

const PAGE_SIZE = 20, MAX_PAGES = 3;
const decimal = (value, signed = false) => typeof value === "string" && (signed ? /^-?\d{1,32}(\.\d{1,18})?$/ : /^\d{1,32}(\.\d{1,18})?$/).test(value) ? value : null;
const bin = value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 ? value : null;
export function validMeteoraPositionTarget(target) {
  return [target?.pool, target?.user, target?.position].every(isSolanaPublicKey) && target.pool !== target.position;
}

export function normalizeMeteoraPosition(row, payload, target, observedAt = new Date().toISOString()) {
  if (!validMeteoraPositionTarget(target) || row?.positionAddress !== target.position || !Number.isFinite(Date.parse(observedAt))) throw Error("Position identity mismatch");
  const lower = bin(row.lowerBinId), upper = bin(row.upperBinId), active = bin(row.poolActiveBinId);
  const closed = typeof row.isClosed === "boolean" ? row.isClosed : null;
  let rangeState = "UNKNOWN";
  if (closed === true) rangeState = "CLOSED";
  else if (closed === false && lower !== null && upper !== null && lower <= upper && active !== null) {
    const outside = active < lower || active > upper;
    if (typeof row.isOutOfRange !== "boolean" || row.isOutOfRange === outside) rangeState = outside ? "OUT_OF_RANGE" : "IN_RANGE";
  }
  const unrealized = row.unrealizedPnl;
  const token = (mint, balance, fees) => ({
    mint: isSolanaPublicKey(mint) ? mint : null,
    principalAmount: decimal(balance?.amount), principalUsd: decimal(balance?.usd),
    unclaimedFeeAmount: decimal(fees?.amount), unclaimedFeeUsd: decimal(fees?.usd)
  });
  return {
    schema: "cofferhouse.meteora.position-observation.v1",
    id: `solana:mainnet:meteora-dlmm:${target.pool}:${target.position}`,
    pool: target.pool, position: target.position, queriedUser: target.user, observedAt,
    source: "Meteora DLMM Data API", onchainVerified: false,
    range: { lowerBinId: lower, upperBinId: upper, activeBinId: active, state: rangeState, isClosed: closed, providerOutOfRange: typeof row.isOutOfRange === "boolean" ? row.isOutOfRange : null },
    rangeNeedsReview: rangeState === "OUT_OF_RANGE" || rangeState === "UNKNOWN",
    tokenX: token(payload.tokenX, unrealized?.balanceTokenX, unrealized?.unclaimedFeeTokenX),
    tokenY: token(payload.tokenY, unrealized?.balanceTokenY, unrealized?.unclaimedFeeTokenY),
    providerPnlUsd: decimal(row.pnlUsd, true),
    providerAllTimeFeesUsd: decimal(row.allTimeFees?.total?.usd),
    providerDepositsUsd: decimal(row.allTimeDeposits?.total?.usd),
    providerWithdrawalsUsd: decimal(row.allTimeWithdrawals?.total?.usd),
    costAdjustedPnlUsd: null, holdingBenchmarkUsd: null,
    notice: "Indexed position observation, not independent ownership verification. Provider PnL and fee fields are not added together. Costs and holding benchmark remain unreconciled."
  };
}

export async function fetchMeteoraPosition(target, { fetcher = globalThis.fetch, timeoutMs = 10000 } = {}) {
  if (!validMeteoraPositionTarget(target)) throw Error("Invalid Solana position target");
  const seen = new Set();
  let pagesScanned = 0;
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    for (let page = 1; page <= MAX_PAGES; page++) {
      const query = new URLSearchParams({ user: target.user, status: "all", page: String(page), page_size: String(PAGE_SIZE) });
      const response = await fetcher(`https://dlmm.datapi.meteora.ag/positions/${target.pool}/pnl?${query}`, { method: "GET", redirect: "error", headers: { Accept: "application/json" }, signal });
      if (!response.ok) throw Error("Meteora unavailable");
      const payload = await response.json();
      if (payload.page !== page || !Array.isArray(payload.positions) || payload.positions.length > PAGE_SIZE || typeof payload.hasNext !== "boolean") throw Error("Invalid position page");
      for (const row of payload.positions) {
        if (!isSolanaPublicKey(row?.positionAddress) || seen.has(row.positionAddress)) throw Error("Invalid position identities");
        seen.add(row.positionAddress);
      }
      pagesScanned++;
      const selected = payload.positions.find(row => row.positionAddress === target.position);
      if (selected) return { status: "FOUND", pagesScanned, observation: normalizeMeteoraPosition(selected, payload, target) };
      if (!payload.hasNext) return { status: "NOT_OBSERVED", pagesScanned, observation: null };
    }
    return { status: "NOT_FOUND_IN_SAMPLE", pagesScanned, observation: null };
  } catch { return { status: "UNAVAILABLE", pagesScanned, observation: null }; }
}
