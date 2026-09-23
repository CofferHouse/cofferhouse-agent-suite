import { timingSafeEqual } from "node:crypto";
import { createAcknowledgment } from "../../src/acknowledgment.js";
import { durableStoreConfigured, getJson, pushJson, setJson } from "../_redis.js";

const STATUS_KEY = "cofferhouse:scout:agent-status";
const ACK_KEY = "cofferhouse:scout:latest-acknowledgment";
const ACK_HISTORY_KEY = "cofferhouse:scout:acknowledgment-history";

function authorized(request) {
  const expected = process.env.SCOUT_OPERATOR_TOKEN;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (Number(request.headers["content-length"] ?? 0) > 16_384) return response.status(413).json({ ok: false, error: "Request body too large" });
  if (!authorized(request)) return response.status(401).json({ ok: false, error: "Unauthorized" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });
  try {
    const status = await getJson(STATUS_KEY);
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body ?? {};
    if (!status?.alert?.fingerprint || status.alert.fingerprint !== body.fingerprint) {
      return response.status(409).json({ ok: false, error: "Alert is no longer the active incident." });
    }
    const acknowledgment = createAcknowledgment(body);
    await setJson(ACK_KEY, acknowledgment);
    await pushJson(ACK_HISTORY_KEY, acknowledgment, 100);
    return response.status(200).json({ ok: true, acknowledgment });
  } catch (error) {
    return response.status(400).json({ ok: false, error: error.message });
  }
}
