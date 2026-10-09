import test from "node:test";
import assert from "node:assert/strict";
import { deliverAlert, notificationConfigured, telegramConfigured } from "../api/_notify.js";

const alert = {
  title: "CofferHouse Scout alert",
  message: "USDC / cirBTC moved into the high-risk watchlist.",
  policyVersion: "scout-balanced-0.3",
  fingerprint: "alert-123"
};

test("detects the project Telegram bot independently from user recipients", () => {
  assert.equal(telegramConfigured({ TELEGRAM_BOT_TOKEN: "token" }), true);
  assert.equal(telegramConfigured({}), false);
  assert.equal(notificationConfigured({}), false);
});

test("delivers a native Telegram alert and identifies the channel", async () => {
  let request;
  const fetcher = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };
  const result = await deliverAlert(alert, {
    TELEGRAM_BOT_TOKEN: "123:telegram-token"
  }, fetcher, { chatId: "-100987654321" });
  assert.equal(result.delivered, true);
  assert.equal(result.channel, "telegram");
  assert.match(request.url, /api\.telegram\.org\/bot123:telegram-token\/sendMessage$/);
  assert.deepEqual(JSON.parse(request.options.body), {
    chat_id: "-100987654321",
    text: "CofferHouse Scout alert\nUSDC / cirBTC moved into the high-risk watchlist.\nPolicy: scout-balanced-0.3\nAlert: alert-123",
    disable_web_page_preview: true
  });
});

test("keeps the generic webhook as a fallback alert channel", async () => {
  const fetcher = async () => ({ ok: true });
  const result = await deliverAlert(alert, { SCOUT_ALERT_WEBHOOK_URL: "https://alerts.vendor.net/hook" }, fetcher);
  assert.equal(result.delivered, true);
  assert.equal(result.channel, "webhook");
});
