import { isEvmAddress } from "../market-schema/index.js";

export const defaultAlertPreferences = Object.freeze({
  opportunityEligible: true,
  opportunityWatchlist: true,
  liquidityDeterioration: true,
  utilizationRisk: true,
  apyChange: false,
  guardianAttention: true
});

export function normalizeAlertPreferences(value = {}) {
  return Object.fromEntries(Object.entries(defaultAlertPreferences).map(([key, fallback]) => [key, typeof value[key] === "boolean" ? value[key] : fallback]));
}

export function createTelegramLinkChallenge({ walletAddress, nonce, expiresAt, origin = "https://cofferhouse-scout.vercel.app" }) {
  if (!isEvmAddress(walletAddress)) throw new Error("A valid EVM wallet address is required.");
  if (!/^[a-f0-9-]{16,64}$/i.test(String(nonce ?? ""))) throw new Error("A valid link nonce is required.");
  if (!Number.isFinite(new Date(expiresAt).getTime())) throw new Error("A valid challenge expiry is required.");
  const address = walletAddress.toLowerCase();
  const message = [
    "CofferHouse Telegram alert connection",
    "",
    `Wallet: ${address}`,
    `Origin: ${origin}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "",
    "This signature only links alert preferences. It does not authorize transactions, token approvals, custody or execution."
  ].join("\n");
  return Object.freeze({ schema: "cofferhouse.telegram.challenge.v1", walletAddress: address, nonce, expiresAt: new Date(expiresAt).toISOString(), message });
}

export function createPendingTelegramLink({ walletAddress, code, statusToken, preferences, expiresAt }) {
  if (!isEvmAddress(walletAddress)) throw new Error("A valid EVM wallet address is required.");
  if (!/^[A-Z0-9]{8}$/.test(String(code ?? ""))) throw new Error("A valid Telegram link code is required.");
  if (!/^[a-f0-9]{32}$/i.test(String(statusToken ?? ""))) throw new Error("A valid private status token is required.");
  return Object.freeze({
    schema: "cofferhouse.telegram.pending-link.v1",
    walletAddress: walletAddress.toLowerCase(),
    code,
    statusToken,
    preferences: normalizeAlertPreferences(preferences),
    expiresAt: new Date(expiresAt).toISOString()
  });
}

export function createTelegramSubscription({ pendingLink, chatId, telegramUserId = null, linkedAt = new Date() }) {
  if (pendingLink?.schema !== "cofferhouse.telegram.pending-link.v1") throw new Error("A valid pending Telegram link is required.");
  if (!/^-?\d+$/.test(String(chatId ?? ""))) throw new Error("A valid Telegram chat identifier is required.");
  return Object.freeze({
    schema: "cofferhouse.telegram.subscription.v1",
    walletAddress: pendingLink.walletAddress,
    channel: "telegram",
    chatId: String(chatId),
    telegramUserId: telegramUserId === null ? null : String(telegramUserId),
    preferences: normalizeAlertPreferences(pendingLink.preferences),
    linkedAt: new Date(linkedAt).toISOString(),
    active: true
  });
}

export function telegramAlertCategories(alert) {
  if (alert?.schema === "cofferhouse.guardian.agent-alert.v1") return ["guardianAttention"];
  if (alert?.schema !== "cofferhouse.scout.agent-alert.v1") return [];
  const categories = new Set();
  for (const change of alert.changes ?? []) {
    if (change.type === "liquidity" && change.level !== "info") categories.add("liquidityDeterioration");
    if (change.type === "utilization" && change.level !== "info") categories.add("utilizationRisk");
    if (change.type === "apy") categories.add("apyChange");
    if (change.type === "status" && /to PASS\.$/i.test(change.message ?? "")) categories.add("opportunityEligible");
    if (["new", "removed"].includes(change.type) || (change.type === "status" && !/to PASS\.$/i.test(change.message ?? ""))) categories.add("opportunityWatchlist");
  }
  return [...categories];
}

export function telegramSubscriptionWantsAlert(subscription, alert) {
  if (subscription?.schema !== "cofferhouse.telegram.subscription.v1" || !subscription.active || !subscription.chatId) return false;
  const preferences = normalizeAlertPreferences(subscription.preferences);
  return telegramAlertCategories(alert).some((category) => preferences[category]);
}

export function updateTelegramSubscription(subscription, preferences, updatedAt = new Date()) {
  if (subscription?.schema !== "cofferhouse.telegram.subscription.v1" || !subscription.active) throw new Error("An active Telegram subscription is required.");
  return Object.freeze({ ...subscription, preferences: normalizeAlertPreferences(preferences), updatedAt: new Date(updatedAt).toISOString() });
}
