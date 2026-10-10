import { addSetMember, deleteJson, getJson, pushJson, setJsonIfAbsent, setMembers } from "./_redis.js";
import { sendTelegramMessage, telegramConfigured } from "./_notify.js";
import { telegramAlertCategories, telegramSubscriptionWantsAlert } from "../packages/agent-modules/index.js";

export const TELEGRAM_SUBSCRIBER_INDEX_KEY = "cofferhouse:alerts:telegram:subscribers";
const DELIVERY_HISTORY_KEY = "cofferhouse:alerts:telegram:delivery-history";
const walletKey = (walletAddress) => `cofferhouse:alerts:telegram:wallet:${walletAddress.toLowerCase()}`;
const deliveryKey = (walletAddress, fingerprint) => `cofferhouse:alerts:telegram:delivered:${walletAddress.toLowerCase()}:${fingerprint}`;

export async function registerTelegramSubscriber(walletAddress) {
  return addSetMember(TELEGRAM_SUBSCRIBER_INDEX_KEY, walletAddress.toLowerCase());
}

export async function loadTelegramSubscriptions() {
  const wallets = await setMembers(TELEGRAM_SUBSCRIBER_INDEX_KEY, 500);
  const subscriptions = await Promise.all(wallets.map((wallet) => getJson(walletKey(wallet))));
  return subscriptions.filter((subscription) => subscription?.schema === "cofferhouse.telegram.subscription.v1" && subscription.active);
}

export async function deliverSubscriberAlert(alert, environment = process.env) {
  const categories = telegramAlertCategories(alert);
  if (!telegramConfigured(environment)) return { configured: false, eligible: 0, delivered: 0, failed: 0, categories, reason: "telegram-bot-not-configured" };
  const subscriptions = await loadTelegramSubscriptions();
  const eligible = subscriptions.filter((subscription) => telegramSubscriptionWantsAlert(subscription, alert));
  let delivered = 0;
  let failed = 0;
  for (const subscription of eligible) {
    const key = deliveryKey(subscription.walletAddress, alert.fingerprint);
    const claimed = await setJsonIfAbsent(key, { claimedAt: new Date().toISOString() }, 7 * 24 * 60 * 60);
    if (!claimed) continue;
    try {
      const text = `${alert.title}\n${alert.message}\nCategories: ${categories.join(", ")}\nPolicy: ${alert.policyVersion}\nAlert: ${alert.fingerprint}`;
      await sendTelegramMessage({ chatId: subscription.chatId, text }, environment);
      delivered += 1;
      await pushJson(DELIVERY_HISTORY_KEY, { walletAddress: subscription.walletAddress, fingerprint: alert.fingerprint, categories, deliveredAt: new Date().toISOString() }, 250);
    } catch (error) {
      failed += 1;
      await deleteJson(key);
    }
  }
  return { configured: true, eligible: eligible.length, delivered, failed, categories };
}
