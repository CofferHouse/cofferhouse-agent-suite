export const arcAppKitCatalog = Object.freeze([
  Object.freeze({
    id: "earn",
    label: "Earn Kit",
    ownerView: "opportunity",
    capability: "Discover USDC and EURC vaults, inspect yield and liquidity, and later prepare wallet-controlled deposits or withdrawals.",
    boundary: "Discovery is read-only. Deposits and withdrawals require a connected wallet and an explicit signature.",
    docs: "https://docs.arc.io/app-kit/earn"
  }),
  Object.freeze({
    id: "onramp",
    label: "Onramp Kit",
    ownerView: "holder",
    capability: "Fund an Arc wallet with USDC or EURC through Arc's hosted fiat onramp experience.",
    boundary: "Requires a server-created session, Circle API key, supported jurisdiction, KYC and eligible payment method.",
    docs: "https://docs.arc.io/app-kit/onramp"
  }),
  Object.freeze({
    id: "borrow",
    label: "Borrow Kit",
    ownerView: "action",
    capability: "Model and later originate cirBTC-collateralized USDC loans on Arc.",
    boundary: "CofferHouse exposes research and simulation only until wallet batching, fresh health checks and human approval are connected.",
    docs: "https://docs.arc.io/app-kit/borrow"
  })
]);

export const defaultEarnOpportunityPreferences = Object.freeze({
  capitalUsd: 10_000,
  asset: "ANY",
  minApyPct: 1,
  minAvailableLiquidityUsd: 10_000,
  minTotalDepositsUsd: 50_000,
  maxLiquiditySharePct: 1,
  includeLowLiquidity: false
});
const EARN_PREFERENCES_KEY = "cofferhouse.earn-opportunity.preferences.v1";
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeEarnOpportunityPreferences(value = {}) {
  const asset = ["ANY", "USDC", "EURC"].includes(value.asset) ? value.asset : "ANY";
  return Object.freeze({
    capitalUsd: clamp(finiteOr(value.capitalUsd, defaultEarnOpportunityPreferences.capitalUsd), 1, 1_000_000_000),
    asset,
    minApyPct: clamp(finiteOr(value.minApyPct, defaultEarnOpportunityPreferences.minApyPct), 0, 1_000),
    minAvailableLiquidityUsd: clamp(finiteOr(value.minAvailableLiquidityUsd, defaultEarnOpportunityPreferences.minAvailableLiquidityUsd), 0, 100_000_000_000),
    minTotalDepositsUsd: clamp(finiteOr(value.minTotalDepositsUsd, defaultEarnOpportunityPreferences.minTotalDepositsUsd), 0, 100_000_000_000),
    maxLiquiditySharePct: clamp(finiteOr(value.maxLiquiditySharePct, defaultEarnOpportunityPreferences.maxLiquiditySharePct), 0.01, 10),
    includeLowLiquidity: value.includeLowLiquidity === true || value.includeLowLiquidity === "on"
  });
}

export function loadEarnOpportunityPreferences(storage) {
  try { return normalizeEarnOpportunityPreferences(JSON.parse(storage?.getItem(EARN_PREFERENCES_KEY) ?? "{}")); }
  catch { return { ...defaultEarnOpportunityPreferences }; }
}

export function saveEarnOpportunityPreferences(storage, value) {
  const normalized = normalizeEarnOpportunityPreferences(value);
  try { storage?.setItem(EARN_PREFERENCES_KEY, JSON.stringify(normalized)); } catch { /* Keep the active value in memory. */ }
  return normalized;
}

export function normalizeEarnVault(value = {}) {
  const apy = Number(value.currentApy ?? value.apyProfile?.current);
  const liquidity = Number(value.liquidity ?? value.liquidityProfile?.available);
  const deposits = Number(value.totalDeposits ?? value.liquidityProfile?.totalDeposits);
  return Object.freeze({
    vaultAddress: String(value.vaultAddress ?? value.address ?? ""),
    name: String(value.name ?? "Unnamed Earn vault"),
    protocol: String(value.protocol ?? "Unknown"),
    asset: String(value.asset ?? "Unknown"),
    apyPct: Number.isFinite(apy) ? apy * 100 : null,
    availableLiquidityUsd: Number.isFinite(liquidity) ? liquidity : null,
    totalDepositsUsd: Number.isFinite(deposits) ? deposits : null,
    status: String(value.status ?? value.liquidityProfile?.status ?? "unknown"),
    circleGuarded: value.circleGuarded === true,
    observedAt: value.asOf ?? value.apyProfile?.asOf ?? null,
    warnings: [...(value.riskSignals?.warnings ?? []), ...(value.riskSignals?.earnKitWarnings ?? [])].map(String)
  });
}

export function normalizeEarnVaultResponse(payload = {}) {
  const vaults = Array.isArray(payload.vaults) ? payload.vaults.map(normalizeEarnVault) : [];
  return Object.freeze({
    schema: "cofferhouse.arc-app-kits.earn.v1",
    source: "Circle Arc Earn Kit",
    chain: "Arc",
    mode: "official-read-only",
    observedAt: payload.observedAt ?? new Date().toISOString(),
    vaults,
    summary: Object.freeze({
      total: vaults.length,
      usdc: vaults.filter((vault) => vault.asset === "USDC").length,
      eurc: vaults.filter((vault) => vault.asset === "EURC").length,
      lowLiquidity: vaults.filter((vault) => vault.status === "low_liquidity").length
    })
  });
}

function earnResearchScore(vault, preferences) {
  const apyReference = Math.max(preferences.minApyPct, 5);
  const liquidityReference = Math.max(preferences.minAvailableLiquidityUsd, 1);
  const depositsReference = Math.max(preferences.minTotalDepositsUsd, 1);
  const apy = Math.min(Math.max((vault.apyPct ?? 0) / apyReference, 0), 2) / 2 * 40;
  const liquidity = Math.min(Math.max((vault.availableLiquidityUsd ?? 0) / liquidityReference, 0), 2) / 2 * 25;
  const deposits = Math.min(Math.max((vault.totalDepositsUsd ?? 0) / depositsReference, 0), 2) / 2 * 20;
  const status = vault.status === "active" ? 10 : vault.status === "low_liquidity" ? 2 : 5;
  const sentinel = vault.circleGuarded ? 5 : 0;
  return Math.round(apy + liquidity + deposits + status + sentinel);
}

export function analyzeEarnOpportunities(rawVaults = [], rawPreferences = {}) {
  const preferences = normalizeEarnOpportunityPreferences(rawPreferences);
  const opportunities = rawVaults.map((vault) => {
    const blockers = [];
    const warnings = [...vault.warnings];
    if (!/^0x[a-fA-F0-9]{40}$/.test(vault.vaultAddress)) blockers.push("Vault identity is missing or invalid.");
    if (preferences.asset !== "ANY" && vault.asset !== preferences.asset) blockers.push(`Asset does not match the ${preferences.asset} filter.`);
    if (!Number.isFinite(vault.apyPct)) blockers.push("Observed APY is unavailable.");
    else if (vault.apyPct < preferences.minApyPct) blockers.push("Observed APY is below your minimum.");
    if (!Number.isFinite(vault.availableLiquidityUsd) || vault.availableLiquidityUsd <= 0) blockers.push("Available withdrawal liquidity is unavailable or zero.");
    else if (vault.availableLiquidityUsd < preferences.minAvailableLiquidityUsd) blockers.push("Available liquidity is below your minimum.");
    if (!Number.isFinite(vault.totalDepositsUsd)) blockers.push("Total deposits are unavailable.");
    else if (vault.totalDepositsUsd < preferences.minTotalDepositsUsd) blockers.push("Total deposits are below your minimum.");
    if (vault.status === "low_liquidity" && !preferences.includeLowLiquidity) blockers.push("Earn Kit reports low liquidity and the filter excludes it.");
    if (!vault.circleGuarded) warnings.push("Circle sentinel status is not reported for this vault.");
    if (vault.status !== "active") warnings.push(`Earn Kit vault status: ${vault.status}.`);
    const sizeBound = Number.isFinite(vault.availableLiquidityUsd) ? vault.availableLiquidityUsd * preferences.maxLiquiditySharePct / 100 : 0;
    const maxResearchAmountUsd = Math.max(0, Math.min(preferences.capitalUsd, sizeBound));
    if (maxResearchAmountUsd > 0 && maxResearchAmountUsd < preferences.capitalUsd) warnings.unshift(`Modeled size is capped at ${preferences.maxLiquiditySharePct}% of available liquidity.`);
    const eligible = blockers.length === 0;
    return Object.freeze({
      vaultAddress: vault.vaultAddress, name: vault.name, protocol: vault.protocol, asset: vault.asset,
      eligible, decision: eligible ? "ELIGIBLE_FOR_RESEARCH" : "BLOCKED_BY_LIMITS",
      researchScore: earnResearchScore(vault, preferences), apyPct: vault.apyPct,
      availableLiquidityUsd: vault.availableLiquidityUsd, totalDepositsUsd: vault.totalDepositsUsd,
      maxResearchAmountUsd, status: vault.status, circleGuarded: vault.circleGuarded,
      blockers, warnings, reason: eligible ? "Clears your visible Earn research limits; human review is still required." : blockers[0],
      observedAt: vault.observedAt
    });
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.researchScore - a.researchScore || (b.apyPct ?? -1) - (a.apyPct ?? -1));
  return Object.freeze({
    schema: "cofferhouse.arc-app-kits.earn-analysis.v1", source: "Circle Arc Earn Kit", chain: "Arc",
    observedAt: opportunities.find((item) => item.observedAt)?.observedAt ?? new Date().toISOString(), preferences,
    summary: Object.freeze({ total: opportunities.length, eligible: opportunities.filter((item) => item.eligible).length, blocked: opportunities.filter((item) => !item.eligible).length }),
    opportunities,
    notice: "Research ranking, not a safety probability or recommendation. No deposit, approval, signature or transaction is created."
  });
}

export async function fetchArcEarnVaults(fetcher = globalThis.fetch) {
  if (typeof fetcher !== "function") throw new Error("Fetch is unavailable.");
  const response = await fetcher("/api/app-kits/earn", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Earn Kit request failed (${response.status}).`);
  return normalizeEarnVaultResponse(await response.json());
}
