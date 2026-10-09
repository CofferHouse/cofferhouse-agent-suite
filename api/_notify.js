import { configuredHttpsEndpoint } from "../packages/agent-core/index.js";

export function telegramConfigured(environment = process.env) {
  return Boolean(String(environment.TELEGRAM_CHAT_ID ?? "").trim())
    && Boolean(String(environment.TELEGRAM_BOT_TOKEN ?? "").trim());
}

export function notificationConfigured(environment = process.env) {
  return telegramConfigured(environment) || configuredHttpsEndpoint(environment.SCOUT_ALERT_WEBHOOK_URL);
}

export async function deliverAlert(alert, environment = process.env, fetcher = fetch) {
  if (!notificationConfigured(environment)) return { delivered: false, reason: "alert-channel-not-configured" };
  const text = `${alert.title}\n${alert.message}\nPolicy: ${alert.policyVersion}\nAlert: ${alert.fingerprint}`;
  const telegram = telegramConfigured(environment);
  const endpoint = telegram
    ? `https://api.telegram.org/bot${environment.TELEGRAM_BOT_TOKEN}/sendMessage`
    : environment.SCOUT_ALERT_WEBHOOK_URL;
  const body = telegram
    ? { chat_id: environment.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }
    : { text, content: text, event: alert };
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Alert delivery failed (${response.status}).`);
  return { delivered: true, channel: telegram ? "telegram" : "webhook", deliveredAt: new Date().toISOString() };
}
