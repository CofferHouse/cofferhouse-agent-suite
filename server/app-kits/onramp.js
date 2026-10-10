import { timingSafeEqual } from "node:crypto";
import { createAppServerKit } from "@circle-fin/app-kit/server";
import { configuredSecret } from "../../packages/agent-core/index.js";

const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(String(value ?? ""));
const validAmount = (value) => /^\d+(\.\d{1,2})?$/.test(String(value ?? "")) && Number(value) > 0 && Number(value) <= 100_000;

function authorized(request, expected = process.env.SCOUT_OPERATOR_TOKEN) {
  const supplied = String(request.headers?.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export function onrampReadiness(environment = process.env) {
  const circleConfigured = configuredSecret(environment.CIRCLE_API_KEY, 8);
  const operatorGateConfigured = configuredSecret(environment.SCOUT_OPERATOR_TOKEN);
  const referrerDomain = String(environment.ONRAMP_REFERRER_DOMAIN ?? "").trim();
  return Object.freeze({
    configured: circleConfigured && operatorGateConfigured,
    circleConfigured,
    operatorGateConfigured,
    referrerConfigured: Boolean(referrerDomain),
    mode: circleConfigured && operatorGateConfigured ? "OPERATOR_GATED_DEMO" : "SETUP_REQUIRED",
    sessionTtlMinutes: 30,
    destinationChain: "Arc",
    supportedAssets: ["USDC"],
    execution: { custody: false, automaticPurchase: false, automaticInvestment: false }
  });
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ ok: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "no-store");
  const readiness = onrampReadiness();
  if (request.method === "GET") return response.status(200).json({ ok: true, source: "Circle Arc Onramp Kit", ...readiness });
  if (Number(request.headers?.["content-length"] ?? 0) > 8_192) return response.status(413).json({ ok: false, error: "Request body too large" });
  if (!authorized(request)) return response.status(401).json({ ok: false, error: "Operator authorization is required for the current demo gate." });
  if (!readiness.circleConfigured) return response.status(503).json({ ok: false, configured: false, error: "Circle Onramp is not configured on this deployment." });

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    const destinationAddress = String(body.destinationAddress ?? "").trim();
    const amount = String(body.amount ?? "").trim();
    if (!isAddress(destinationAddress)) return response.status(400).json({ ok: false, error: "A complete EVM destination address is required." });
    if (!validAmount(amount)) return response.status(400).json({ ok: false, error: "Amount must be between 0.01 and 100,000 USD with at most two decimals." });
    const referrerDomain = String(process.env.ONRAMP_REFERRER_DOMAIN ?? "").trim();
    const server = createAppServerKit({ onramp: { apiKey: process.env.CIRCLE_API_KEY, ...(referrerDomain ? { referrerDomain } : {}) } });
    const session = await server.onramp.createSession({
      appUserId: `cofferhouse:${destinationAddress.toLowerCase()}`,
      destinationAddress,
      destinationChain: "Arc",
      amount,
      currency: "USD",
      assets: { pairs: [{ token: "USDC", chain: "Arc" }] },
      metadata: { product: "CofferHouse Holder Center", purpose: "user-controlled wallet funding" }
    });
    return response.status(201).json({ ok: true, source: "Circle Arc Onramp Kit", session });
  } catch (error) {
    const status = error?.type === "INPUT" ? 400 : error?.type === "RATE_LIMIT" ? 429 : error?.type === "NETWORK" ? 504 : 502;
    return response.status(status).json({ ok: false, error: error?.message ?? "Onramp session creation failed.", recoverability: error?.recoverability ?? "UNKNOWN" });
  }
}
