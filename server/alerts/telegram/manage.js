import { durableStoreConfigured, deleteJson, getJson, setJson } from "../../_redis.js";
import { unregisterTelegramSubscriber } from "../../_subscriber-alerts.js";
import { normalizeAlertPreferences, updateTelegramSubscription } from "../../../packages/agent-modules/index.js";

const statusKey = (token) => `cofferhouse:alerts:telegram:status:${token}`;
const walletKey = (walletAddress) => `cofferhouse:alerts:telegram:wallet:${walletAddress.toLowerCase()}`;
const chatKey = (chatId) => `cofferhouse:alerts:telegram:chat:${chatId}`;

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (Number(request.headers?.["content-length"] ?? 0) > 8_192) return response.status(413).json({ ok: false, error: "Request body too large" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    const token = String(body.token ?? "");
    if (!/^[a-f0-9]{32}$/i.test(token)) throw new Error("A valid private status token is required.");
    const status = await getJson(statusKey(token));
    if (status?.status !== "CONNECTED" || !status.walletAddress) throw new Error("The private Telegram management session is not connected.");
    const subscription = await getJson(walletKey(status.walletAddress));
    if (!subscription?.active) throw new Error("The Telegram subscription is no longer active.");
    const action = String(body.action ?? "UPDATE").toUpperCase();
    if (action === "UPDATE") {
      const updated = updateTelegramSubscription(subscription, body.preferences);
      await setJson(walletKey(status.walletAddress), updated);
      await setJson(statusKey(token), { ...status, preferences: updated.preferences, updatedAt: updated.updatedAt });
      return response.status(200).json({ ok: true, status: "CONNECTED", preferences: updated.preferences, updatedAt: updated.updatedAt });
    }
    if (action === "DISCONNECT") {
      await deleteJson(walletKey(status.walletAddress), chatKey(subscription.chatId));
      await unregisterTelegramSubscriber(status.walletAddress);
      await setJson(statusKey(token), { status: "DISCONNECTED", disconnectedAt: new Date().toISOString() });
      return response.status(200).json({ ok: true, status: "DISCONNECTED" });
    }
    throw new Error("Unsupported Telegram management action.");
  } catch (error) {
    return response.status(400).json({ ok: false, error: error.message });
  }
}
