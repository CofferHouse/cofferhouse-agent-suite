export const GATEWAY_ASSETS = Object.freeze([
  Object.freeze({ token: "USDC", decimals: 6 }),
  Object.freeze({ token: "EURC", decimals: 6 }),
  Object.freeze({ token: "cirBTC", decimals: 8 })
]);
const ARC_DOMAIN = 26;
const SOLANA_DOMAIN = 5;
const EVM_DOMAINS = new Set([0, 1, 2, 3, 6, 7, 10, 13, 14, 16, 19, 26]);
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const validAddress = value => typeof value === "string" && ADDRESS.test(value);
const tokens = value => Array.isArray(value) && value.every(item => typeof item === "string") ? value : null;

export function gatewayUnits(value, decimals) {
  if (typeof value !== "string" || !Number.isInteger(decimals) || decimals < 0 || decimals > 8) return null;
  const match = value.match(/^(0|[1-9][0-9]{0,60})(?:\.([0-9]+))?$/);
  if (!match || (match[2]?.length ?? 0) > decimals) return null;
  return (BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt((match[2] ?? "").padEnd(decimals, "0") || "0")).toString();
}

export function gatewayAmount(units, decimals) {
  if (typeof units !== "string" || !/^(0|[1-9][0-9]*)$/.test(units) || !Number.isInteger(decimals) || decimals < 0 || decimals > 8) return null;
  if (!decimals) return units;
  const value = units.padStart(decimals + 1, "0");
  return `${value.slice(0, -decimals)}.${value.slice(-decimals)}`;
}

export function normalizeGatewayInfo(payload) {
  if (!Array.isArray(payload?.domains) || !payload.domains.length || payload.domains.length > 64) throw new Error("Gateway domain coverage is unavailable.");
  const seen = new Set();
  return payload.domains.map(item => {
    if (!Number.isInteger(item.domain) || item.domain < 0 || item.domain > 65535 || seen.has(item.domain) || item.network !== "Mainnet" || typeof item.chain !== "string" || !item.chain || item.chain.length > 64) throw new Error("Gateway domain identity is invalid or ambiguous.");
    seen.add(item.domain);
    const contract = value => {
      if (!value) return { address: null, tokens: null };
      if (typeof value.address !== "string" || (EVM_DOMAINS.has(item.domain) && !validAddress(value.address)) || value.address.length > 128) throw new Error("Gateway contract identity is invalid.");
      return { address: value.address, tokens: tokens(value.supportedTokens) };
    };
    return {
      domain: item.domain, chain: item.chain, network: item.network,
      wallet: contract(item.walletContract), minter: contract(item.minterContract),
      processedHeight: typeof item.processedHeight === "string" && /^\d+$/.test(item.processedHeight) ? item.processedHeight : null,
      evm: item.domain !== SOLANA_DOMAIN && EVM_DOMAINS.has(item.domain)
    };
  });
}

export function gatewayCapabilities(domains) {
  const destination = domains.find(item => item.domain === ARC_DOMAIN && item.chain.toLowerCase() === "arc");
  return GATEWAY_ASSETS.map(asset => ({
    ...asset,
    arcDestination: destination?.minter.tokens === null || !destination ? null : destination.minter.tokens.includes(asset.token),
    routes: domains.filter(item => item.evm).map(source => ({
      domain: source.domain, chain: source.chain,
      sourceSupported: source.wallet.tokens === null ? null : source.wallet.tokens.includes(asset.token),
      destinationSupported: destination?.minter.tokens === null || !destination ? null : destination.minter.tokens.includes(asset.token),
      status: source.wallet.tokens === null || !destination || destination.minter.tokens === null ? "UNKNOWN"
        : !source.wallet.tokens.includes(asset.token) || !destination.minter.tokens.includes(asset.token) ? "NOT_SUPPORTED"
          : source.domain === ARC_DOMAIN ? "ARC_BALANCE_SOURCE" : "SUPPORTED_BY_API"
    }))
  }));
}

export function normalizeGatewayBalances(payload, { token, decimals, depositor, sources }) {
  if (payload?.token !== token || !Array.isArray(payload.balances) || payload.balances.length > 64) throw new Error("Gateway balance asset is missing or mismatched.");
  const expected = new Set(sources.map(source => source.domain));
  const received = new Map();
  for (const item of payload.balances) {
    if (!expected.has(item.domain) || !validAddress(item.depositor) || item.depositor.toLowerCase() !== depositor.toLowerCase() || received.has(item.domain)) throw new Error("Gateway returned unexpected or duplicated balance identity.");
    received.set(item.domain, gatewayUnits(item.balance, decimals));
  }
  const balances = sources.map(source => ({ domain: source.domain, chain: source.chain, confirmedUnits: received.get(source.domain) ?? null }));
  const complete = balances.every(item => item.confirmedUnits !== null);
  return {
    status: complete ? "OBSERVED" : "PARTIAL_EVIDENCE",
    confirmedUnits: complete ? balances.reduce((total, item) => total + BigInt(item.confirmedUnits), 0n).toString() : null,
    balances
  };
}

export async function fetchGatewayObservation({ depositor = null } = {}, { fetcher = globalThis.fetch, now = () => new Date().toISOString() } = {}) {
  if (depositor !== null && !validAddress(depositor)) throw new Error("A valid EVM depositor address is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const request = async (path, body) => {
    const response = await fetcher(`https://gateway-api.circle.com/v1/${path}`, {
      method: body ? "POST" : "GET", signal: controller.signal, redirect: "error",
      headers: body ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error(`Gateway source unavailable (${response.status}).`);
    return response.json();
  };
  try {
    const domains = normalizeGatewayInfo(await request("info"));
    const capabilities = gatewayCapabilities(domains);
    const assets = await Promise.all(capabilities.map(async capability => {
      const sources = domains.filter(domain => domain.evm && domain.wallet.tokens?.includes(capability.token));
      if (!depositor || !sources.length) return { ...capability, status: !depositor ? "NOT_REQUESTED" : "UNAVAILABLE", confirmedUnits: null, balances: [] };
      try {
        const payload = await request("balances", { token: capability.token, sources: sources.map(source => ({ domain: source.domain, depositor })) });
        const balance = normalizeGatewayBalances(payload, { ...capability, depositor, sources });
        if (domains.some(domain => domain.evm && domain.wallet.tokens === null)) {
          balance.status = "PARTIAL_EVIDENCE";
          balance.confirmedUnits = null;
        }
        return { ...capability, ...balance };
      } catch {
        return { ...capability, status: "UNAVAILABLE", confirmedUnits: null, balances: sources.map(source => ({ domain: source.domain, chain: source.chain, confirmedUnits: null })) };
      }
    }));
    return {
      schema: "cofferhouse.gateway.observation.v1", source: "Circle Gateway mainnet API", observedAt: now(),
      network: "mainnet", depositor: depositor?.toLowerCase() ?? null, destination: { chain: "Arc", domain: ARC_DOMAIN },
      domains, assets,
      limitations: ["API-reported coverage is not a transfer quote or independent contract verification.", "Balances cover the same EVM address across reported EVM domains; Solana is excluded.", "These are confirmed Gateway deposits, not wallet balances. Pending deposits are not included.", "Assets remain separate. No exchange, USD total or treasury allocation is calculated."]
    };
  } finally { clearTimeout(timeout); }
}
