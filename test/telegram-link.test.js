import test from "node:test";
import assert from "node:assert/strict";
import { createPendingTelegramLink, createTelegramLinkChallenge, createTelegramSubscription, defaultAlertPreferences, normalizeAlertPreferences } from "../packages/agent-modules/index.js";

const walletAddress = "0x1111111111111111111111111111111111111111";

test("creates an explicit alerts-only wallet signing challenge", () => {
  const challenge = createTelegramLinkChallenge({ walletAddress, nonce: "12345678-1234-1234-1234-123456789abc", expiresAt: "2026-10-09T01:00:00.000Z" });
  assert.equal(challenge.walletAddress, walletAddress);
  assert.match(challenge.message, /does not authorize transactions/i);
  assert.match(challenge.message, new RegExp(walletAddress));
});

test("normalizes user alert categories without enabling unknown fields", () => {
  const preferences = normalizeAlertPreferences({ apyChange: true, guardianAttention: false, unknown: true });
  assert.equal(preferences.apyChange, true);
  assert.equal(preferences.guardianAttention, false);
  assert.equal(preferences.opportunityEligible, defaultAlertPreferences.opportunityEligible);
  assert.equal("unknown" in preferences, false);
});

test("converts one temporary code into one wallet-scoped Telegram subscription", () => {
  const pendingLink = createPendingTelegramLink({ walletAddress, code: "A1B2C3D4", preferences: { apyChange: true }, expiresAt: "2026-10-09T01:00:00.000Z" });
  const subscription = createTelegramSubscription({ pendingLink, chatId: "-100123456789", telegramUserId: "42", linkedAt: new Date("2026-10-09T00:50:00.000Z") });
  assert.equal(subscription.walletAddress, walletAddress);
  assert.equal(subscription.chatId, "-100123456789");
  assert.equal(subscription.telegramUserId, "42");
  assert.equal(subscription.preferences.apyChange, true);
  assert.equal(subscription.active, true);
  assert.equal("botToken" in subscription, false);
});

test("rejects malformed wallet, code and Telegram identifiers", () => {
  assert.throws(() => createTelegramLinkChallenge({ walletAddress: "not-a-wallet", nonce: "12345678-1234-1234", expiresAt: new Date() }), /wallet/i);
  assert.throws(() => createPendingTelegramLink({ walletAddress, code: "short", expiresAt: new Date() }), /code/i);
  const pendingLink = createPendingTelegramLink({ walletAddress, code: "A1B2C3D4", expiresAt: new Date() });
  assert.throws(() => createTelegramSubscription({ pendingLink, chatId: "chat-name" }), /chat/i);
});
