const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
// Mint and program keys are case-sensitive 32-byte base58 values.
export function isSolanaPublicKey(value) {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) return false;
  let n = 0n;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return false;
    n = n * 58n + BigInt(digit);
  }
  let bytes = 0;
  while (n) { bytes++; n >>= 8n; }
  const leading = value.match(/^1*/)[0].length;
  return leading + bytes === 32;
}
const units = value => typeof value === "string" && /^(0|[1-9][0-9]{0,77})$/.test(value) ? value : null;
const rate = value => typeof value === "string" && /^\d{1,32}(\.\d{1,18})?$/.test(value) ? value : null;
export function normalizeJupiterEarnTokens(payload, observedAt = new Date().toISOString()) {
  if (!Array.isArray(payload) || payload.length > 200 || !Number.isFinite(Date.parse(observedAt))) throw Error("Invalid Jupiter token list");
  const seen = new Set();
  return payload.map(item => {
    if (!isSolanaPublicKey(item?.address) || !isSolanaPublicKey(item?.assetAddress) || item.asset?.address !== item.assetAddress || seen.has(item.address)) throw Error("Invalid Jupiter token identity");
    if (typeof item.asset.symbol !== "string" || !item.asset.symbol.length || item.asset.symbol.length > 32 || !Number.isInteger(item.asset.decimals) || item.asset.decimals < 0 || item.asset.decimals > 18) throw Error("Incomplete Jupiter asset");
    seen.add(item.address);
    return {
      id: `solana:mainnet:jupiter-lend:${item.address}`, network:"Solana mainnet", protocol:"Jupiter Lend Earn",
      lendingMint:item.address, asset:{mint:item.assetAddress,symbol:item.asset.symbol,decimals:item.asset.decimals},
      observedAt, totalAssetsUnits:units(item.totalAssets), totalSharesUnits:units(item.totalSupply),
      providerRates:{supply:rate(item.supplyRate),rewards:rate(item.rewardsRate),total:rate(item.totalRate)},
      supplyApyPct:null, withdrawableLiquidityUsd:null, rateUnitsVerified:false
    };
  });
}
export async function fetchJupiterEarnTokens({apiKey,fetcher=globalThis.fetch,timeoutMs=10000}={}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) return {configured:false,status:"NOT_CONFIGURED",tokens:[]};
  try {
    const response=await fetcher("https://api.jup.ag/lend/v1/earn/tokens", {
      method:"GET",redirect:"error",headers:{Accept:"application/json","x-api-key":apiKey},signal:AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw Error("Jupiter unavailable");
    const tokens=normalizeJupiterEarnTokens(await response.json());
    return {configured:true,status:tokens.length ? "FOUND" : "NO_MATCH",tokens};
  } catch {return {configured:true,status:"UNAVAILABLE",tokens:[]};}
}
