export const ARC_MAINNET_CHAIN_ID = 5042;
export const ARC_MAINNET_CHAIN_HEX = "0x13b2";

export function disconnectedHolderIdentity(providerAvailable = false) {
  return Object.freeze({
    status: providerAvailable ? "READY" : "NO_PROVIDER",
    address: null,
    chainId: null,
    isArc: false,
    message: providerAvailable ? "Wallet provider detected. Connect to read the active address and network." : "No browser wallet was detected. The representative preview remains available."
  });
}

export function normalizeChainId(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseInt(value, value.toLowerCase().startsWith("0x") ? 16 : 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function readHolderIdentity(provider) {
  if (!provider || typeof provider.request !== "function") return disconnectedHolderIdentity(false);
  const [accounts, rawChainId] = await Promise.all([
    provider.request({ method: "eth_requestAccounts" }),
    provider.request({ method: "eth_chainId" })
  ]);
  const address = Array.isArray(accounts) && /^0x[a-fA-F0-9]{40}$/.test(accounts[0] ?? "") ? accounts[0] : null;
  const chainId = normalizeChainId(rawChainId);
  const isArc = chainId === ARC_MAINNET_CHAIN_ID;
  return Object.freeze({
    status: address ? (isArc ? "CONNECTED" : "WRONG_NETWORK") : "NO_ACCOUNT",
    address,
    chainId,
    isArc,
    message: !address ? "The wallet did not expose an account." : isArc ? "Read-only identity connected on Arc mainnet." : `Connected on chain ${chainId ?? "unknown"}. Switch to Arc mainnet in your wallet to continue.`
  });
}
