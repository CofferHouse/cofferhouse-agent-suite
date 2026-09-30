export const ARC_CHAIN_ID = 5042;
export const ARC_CHAIN_SLUG = "arc";
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
export function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
export function isEvmAddress(value) { return EVM_ADDRESS.test(String(value ?? "")); }
export function normalizeEvmAddress(value) { return isEvmAddress(value) ? String(value).toLowerCase() : null; }
export function isArcChain(value) { return value === ARC_CHAIN_ID || String(value).toLowerCase() === String(ARC_CHAIN_ID) || String(value).toLowerCase() === ARC_CHAIN_SLUG; }
export function validateMarketObservation(market) {
  const errors = [];
  if (!market || typeof market !== "object") return { valid: false, errors: ["Market observation must be an object."] };
  if (!String(market.id ?? "").trim()) errors.push("Market id is required.");
  if (!String(market.marketId ?? "").trim()) errors.push("Protocol market id is required.");
  if (!String(market.protocol ?? "").trim()) errors.push("Protocol is required.");
  if (!isArcChain(market.chainId ?? market.network)) errors.push("Market must identify Arc mainnet.");
  for (const field of ["liquidityUsd", "utilizationPct", "apyPct"]) if (market[field] !== null && market[field] !== undefined && !Number.isFinite(market[field])) errors.push(`${field} must be finite or null.`);
  if (Number.isFinite(market.liquidityUsd) && market.liquidityUsd < 0) errors.push("liquidityUsd cannot be negative.");
  if (Number.isFinite(market.utilizationPct) && (market.utilizationPct < 0 || market.utilizationPct > 100)) errors.push("utilizationPct must be between 0 and 100.");
  return { valid: errors.length === 0, errors };
}
export function assertMarketObservation(market) {
  const validation = validateMarketObservation(market);
  if (!validation.valid) throw new Error(`Invalid market observation: ${validation.errors.join(" ")}`);
  return market;
}
