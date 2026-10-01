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

export async function fetchArcEarnVaults(fetcher = globalThis.fetch) {
  if (typeof fetcher !== "function") throw new Error("Fetch is unavailable.");
  const response = await fetcher("/api/app-kits/earn", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Earn Kit request failed (${response.status}).`);
  return normalizeEarnVaultResponse(await response.json());
}
