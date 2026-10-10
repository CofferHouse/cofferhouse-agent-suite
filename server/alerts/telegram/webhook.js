import { timingSafeEqual } from "node:crypto";
import { deleteJson, durableStoreConfigured, getJson, setJson } from "../../_redis.js";
import { sendTelegramMessage, telegramConfigured } from "../../_notify.js";
import { createTelegramSubscription } from "../../../packages/agent-modules/index.js";

const pendingKey = (code) => `cofferhouse:alerts:telegram:pending:${code}`;
const walletKey = (walletAddress) => `cofferhouse:alerts:telegram:wallet:${walletAddress.toLowerCase()}`;
const chatKey = (chatId) => `cofferhouse:alerts:telegram:chat:${chatId}`;

function authorized(request, expected = process.env.TELEGRAM_WEBHOOK_SECRET) {
  const supplied = String(request.headers?.["x-telegram-bot-api-secret-token"] ?? "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (!authorized(request)) return response.status(401).json({ ok: false, error: "Unauthorized" });
  if (!durableStoreConfigured() || !telegramConfigured()) return response.status(503).json({ ok: false, error: "Telegram linking is not configured." });
  try {
    const update = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    const message = update.message ?? update.edited_message;
    const match = String(message?.text ?? "").trim().match(/^\/start\s+([A-Z0-9]{8})$/i);
    if (!match || !message?.chat?.id) return response.status(200).json({ ok: true, linked: false, reason: "no-link-command" });
    const code = match[1].toUpperCase();
    const pendingLink = await getJson(pendingKey(code));
    if (!pendingLink || Date.now() > new Date(pendingLink.expiresAt).getTime()) {
      await sendTelegramMessage({ chatId: message.chat.id, text: "This CofferHouse connection code is invalid or expired. Return to Holder Center and request a new one." });
      return response.status(200).json({ ok: true, linked: false, reason: "expired-or-invalid-code" });
    }
    const subscription = createTelegramSubscription({ pendingLink, chatId: message.chat.id, telegramUserId: message.from?.id });
    await setJson(walletKey(subscription.walletAddress), subscription);
    await setJson(chatKey(subscription.chatId), { walletAddress: subscription.walletAddress, linkedAt: subscription.linkedAt });
    await setJson(`cofferhouse:alerts:telegram:status:${pendingLink.statusToken}`, { status: "CONNECTED", linkedAt: subscription.linkedAt });
    await deleteJson(pendingKey(code));
    await sendTelegramMessage({ chatId: subscription.chatId, text: "CofferHouse alerts connected. You will receive only the categories enabled in Holder Center. No transaction or custody permission was granted." });
    return response.status(200).json({ ok: true, linked: true });
  } catch (error) {
    return response.status(200).json({ ok: false, linked: false, error: error.message });
  }
}
