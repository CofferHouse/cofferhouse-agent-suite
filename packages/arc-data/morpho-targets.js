import { normalizeMorphoMarket } from "./morpho.js";

const ENDPOINT = "https://api.morpho.org/graphql";
const MARKET_ID = /^0x[0-9a-f]{64}$/i;
const FIELDS = `marketId chain { id } listed lltv
  loanAsset { address symbol decimals }
  collateralAsset { address symbol decimals }
  oracle { address }
  state { supplyAssetsUsd borrowAssetsUsd liquidityAssetsUsd utilization supplyApy borrowApy }`;

// Guardian targets are not a ranked/listed discovery universe.
export async function fetchMorphoArcTargets(targetIds, { fetcher = globalThis.fetch, timeoutMs = 12_000, now = () => new Date() } = {}) {
  if (!Array.isArray(targetIds) || targetIds.length > 20) throw new Error("Up to 20 Guardian target IDs are supported.");
  const ids = [...new Set(targetIds.map(value => typeof value === "string" ? value.toLowerCase() : ""))];
  if (!ids.length) return [];
  const results = new Map(ids.map(targetId => [targetId, { targetId, status: "UNAVAILABLE", code: "INVALID_TARGET", market: null }]));
  const valid = ids.filter(id => MARKET_ID.test(id));
  if (!valid.length) return [...results.values()];
  const definitions = valid.map((_, index) => `$id${index}: String!`).join(", ");
  const selections = valid.map((_, index) => `target${index}: marketById(marketId: $id${index}, chainId: 5042) { ${FIELDS} }`).join("\n");
  const query = `query GuardianArcTargets(${definitions}) { ${selections} }`;
  const variables = Object.fromEntries(valid.map((id, index) => [`id${index}`, id]));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const unavailable = code => {
    for (const targetId of valid) results.set(targetId, { targetId, status: "UNAVAILABLE", code, market: null });
  };
  try {
    const response = await fetcher(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query, variables }), signal: controller.signal, redirect: "error" });
    if (!response.ok) { unavailable(`HTTP_${response.status}`); return [...results.values()]; }
    const payload = await response.json();
    if (!payload?.data || typeof payload.data !== "object" || payload.errors && !Array.isArray(payload.errors)) {
      unavailable("INVALID_RESPONSE"); return [...results.values()];
    }
    const errors = payload.errors ?? [];
    const globalError = errors.some(error => !Array.isArray(error.path) || !valid.some((_, index) => error.path[0] === `target${index}`));
    const observedAt = now();
    for (const [index, targetId] of valid.entries()) {
      const alias = `target${index}`;
      const result = (status, code, market = null) => results.set(targetId, { targetId, status, code, observedAt: observedAt.toISOString(), market });
      if (globalError || errors.some(error => error.path?.[0] === alias)) { result("UNAVAILABLE", "GRAPHQL_ERROR"); continue; }
      if (!Object.hasOwn(payload.data, alias)) { result("UNAVAILABLE", "MISSING_RESPONSE"); continue; }
      const item = payload.data[alias];
      if (item === null) { result("NOT_INDEXED", "NO_INDEXED_TARGET"); continue; }
      if (typeof item?.marketId !== "string" || item.marketId.toLowerCase() !== targetId || item.chain?.id !== 5042) { result("UNAVAILABLE", "IDENTITY_MISMATCH"); continue; }
      try { result("FOUND", null, normalizeMorphoMarket(item, observedAt)); }
      catch { result("UNAVAILABLE", "INCOMPLETE_TARGET"); }
    }
    return [...results.values()];
  } catch (error) {
    unavailable(error?.name === "AbortError" ? "TIMEOUT" : "SOURCE_ERROR");
    return [...results.values()];
  } finally { clearTimeout(timer); }
}
