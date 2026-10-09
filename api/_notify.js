import { configuredHttpsEndpoint } from "../packages/agent-core/index.js";

export function telegramConfigured(environment = process.env) {
  return Boolean(String(environment.TELEGRAM_BOT_TOKEN ?? "").trim());
}

export function notificationConfigured(environment = process.env) {
  return telegramConfigured(environment) || configuredHttpsEndpoint(environment.SCOUT_ALERT_WEBHOOK_URL);
}

export async function sendTelegramMessage({ chatId, text }, environment = process.env, fetcher = fetch) {
  if (!telegramConfigured(environment)) return { delivered: false, reason: "telegram-bot-not-configured" };
  if (!String(chatId ?? "").trim()) return { delivered: false, reason: "telegram-recipient-required" };
  const response = await fetcher(`https://api.telegram.org/bot${environment.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: String(chatId), text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`Telegram delivery failed (${response.status}).`);
  return { delivered: true, channel: "telegram", deliveredAt: new Date().toISOString() };
}

export async function deliverAlert(alert, environment = process.env, fetcher = fetch, recipient = {}) {
  const telegram = telegramConfigured(environment) && Boolean(String(recipient.chatId ?? "").trim());
  const webhook = configuredHttpsEndpoint(environment.SCOUT_ALERT_WEBHOOK_URL);
  if (!telegram && !webhook) return { delivered: false, reason: "alert-channel-not-configured" };
  const text = `${alert.title}\n${alert.message}\nPolicy: ${alert.policyVersion}\nAlert: ${alert.fingerprint}`;
  if (telegram) return sendTelegramMessage({ chatId: recipient.chatId, text }, environment, fetcher);
  const body = { text, content: text, event: alert };
  const response = await fetcher(environment.SCOUT_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Alert delivery failed (${response.status}).`);
  return { delivered: true, channel: "webhook", deliveredAt: new Date().toISOString() };
}
