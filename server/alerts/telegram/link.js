import { randomBytes } from "node:crypto";
import { verifyMessage } from "viem";
import { deleteJson, durableStoreConfigured, getJson, setJsonWithTtl } from "../../_redis.js";
import { createPendingTelegramLink } from "../../../packages/agent-modules/index.js";

const LINK_TTL_SECONDS = 10 * 60;
const challengeKey = (walletAddress) => `cofferhouse:alerts:telegram:challenge:${walletAddress.toLowerCase()}`;
const pendingKey = (code) => `cofferhouse:alerts:telegram:pending:${code}`;

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (Number(request.headers?.["content-length"] ?? 0) > 8_192) return response.status(413).json({ ok: false, error: "Request body too large" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    const walletAddress = String(body.walletAddress ?? "").toLowerCase();
    const challenge = await getJson(challengeKey(walletAddress));
    if (!challenge || Date.now() > new Date(challenge.expiresAt).getTime()) throw new Error("The Telegram connection challenge is missing or expired.");
    const valid = await verifyMessage({ address: walletAddress, message: challenge.message, signature: body.signature });
    if (!valid) throw new Error("The wallet signature does not match the connection challenge.");
    const code = randomBytes(4).toString("hex").toUpperCase();
    const statusToken = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + LINK_TTL_SECONDS * 1_000).toISOString();
    const pendingLink = createPendingTelegramLink({ walletAddress, code, statusToken, preferences: body.preferences, expiresAt });
    await setJsonWithTtl(pendingKey(code), pendingLink, LINK_TTL_SECONDS);
    await setJsonWithTtl(`cofferhouse:alerts:telegram:status:${statusToken}`, { status: "PENDING", expiresAt }, LINK_TTL_SECONDS);
    await deleteJson(challengeKey(walletAddress));
    const botUsername = /^[A-Za-z0-9_]{5,32}$/.test(process.env.TELEGRAM_BOT_USERNAME ?? "") ? process.env.TELEGRAM_BOT_USERNAME : null;
    return response.status(200).json({
      ok: true,
      code,
      statusToken,
      expiresAt,
      telegramUrl: botUsername ? `https://t.me/${botUsername}?start=${code}` : null,
      authority: { alertsOnly: true, transactions: false, tokenApprovals: false, custody: false }
    });
  } catch (error) {
    return response.status(400).json({ ok: false, error: error.message });
  }
}
