import { randomUUID } from "node:crypto";
import { durableStoreConfigured, setJsonWithTtl } from "../../_redis.js";
import { createTelegramLinkChallenge } from "../../../packages/agent-modules/index.js";
import { configuredSecret } from "../../../packages/agent-core/index.js";

const CHALLENGE_TTL_SECONDS = 10 * 60;
const challengeKey = (walletAddress) => `cofferhouse:alerts:telegram:challenge:${walletAddress.toLowerCase()}`;

export default async function handler(request, response) {
  if (request.method === "GET") {
    const botConfigured = configuredSecret(process.env.TELEGRAM_BOT_TOKEN);
    const usernameConfigured = /^[A-Za-z0-9_]{5,32}$/.test(process.env.TELEGRAM_BOT_USERNAME ?? "");
    const webhookProtected = configuredSecret(process.env.TELEGRAM_WEBHOOK_SECRET);
    return response.status(200).json({ ok: true, configured: durableStoreConfigured() && botConfigured && usernameConfigured && webhookProtected, durableStore: durableStoreConfigured(), botConfigured, usernameConfigured, webhookProtected });
  }
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (Number(request.headers?.["content-length"] ?? 0) > 4_096) return response.status(413).json({ ok: false, error: "Request body too large" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1_000).toISOString();
    const challenge = createTelegramLinkChallenge({
      walletAddress: body.walletAddress,
      nonce: randomUUID(),
      expiresAt,
      origin: process.env.COFFERHOUSE_PUBLIC_ORIGIN ?? "https://cofferhouse-scout.vercel.app"
    });
    await setJsonWithTtl(challengeKey(challenge.walletAddress), challenge, CHALLENGE_TTL_SECONDS);
    return response.status(200).json({ ok: true, challenge });
  } catch (error) {
    return response.status(400).json({ ok: false, error: error.message });
  }
}
