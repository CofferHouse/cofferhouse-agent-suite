import { timingSafeEqual } from "node:crypto";
import { deleteJson, durableStoreConfigured, getJson, pushJson, setJson } from "../_redis.js";
import { verifyReceiptDocument } from "../../packages/evidence/index.js";

const WATCH_KEY = "cofferhouse:guardian:active-watch";
const LATEST_KEY = "cofferhouse:guardian:latest-receipt";
const HISTORY_KEY = "cofferhouse:guardian:receipt-history";
const MAX_WATCHES = 20;

const asList = (value) => Array.isArray(value) ? value : value ? [value] : [];
const sameTarget = (left, right) => left?.watch?.target?.id?.toLowerCase() === right?.watch?.target?.id?.toLowerCase();

function authorized(request) {
  const expected = process.env.SCOUT_OPERATOR_TOKEN;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export default async function handler(request, response) {
  if (!["POST", "DELETE"].includes(request.method)) return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (Number(request.headers["content-length"] ?? 0) > 32_768) return response.status(413).json({ ok: false, error: "Request body too large" });
  if (!authorized(request)) return response.status(401).json({ ok: false, error: "Unauthorized" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });

  if (request.method === "DELETE") {
    const targetId = String(request.query?.target ?? "").toLowerCase();
    if (!targetId) {
      await deleteJson(WATCH_KEY, LATEST_KEY);
      return response.status(200).json({ ok: true, active: false, watchCount: 0 });
    }
    const registrations = asList(await getJson(WATCH_KEY));
    const remaining = registrations.filter((item) => item.watch?.target?.id?.toLowerCase() !== targetId);
    const receipts = asList(await getJson(LATEST_KEY)).filter((item) => item.watch?.target?.id?.toLowerCase() !== targetId);
    await setJson(WATCH_KEY, remaining);
    await setJson(LATEST_KEY, receipts);
    return response.status(200).json({ ok: true, active: remaining.length > 0, watchCount: remaining.length });
  }

  try {
    const receipt = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const verification = verifyReceiptDocument(receipt);
    if (!verification.valid || receipt?.schema !== "cofferhouse.guardian.receipt.v1") throw new Error("A valid sealed Guardian receipt is required.");
    const watch = receipt.watch;
    if (watch?.source !== "LENDING") throw new Error("Durable Guardian currently supports lending-market watches only.");
    if (!Number.isFinite(new Date(watch.approval?.expiresAt).getTime()) || Date.now() > new Date(watch.approval.expiresAt).getTime()) throw new Error("The human approval expired before durable registration.");
    const registration = {
      schema: "cofferhouse.guardian.registration.v1",
      registeredAt: new Date().toISOString(),
      watch,
      sourceReceiptId: receipt.receiptId,
      execution: { automatedAction: false, transactionAuthority: false }
    };
    const registrations = asList(await getJson(WATCH_KEY));
    const existingIndex = registrations.findIndex((item) => sameTarget(item, registration));
    if (existingIndex >= 0) registrations[existingIndex] = registration;
    else registrations.push(registration);
    if (registrations.length > MAX_WATCHES) throw new Error(`Durable Guardian supports up to ${MAX_WATCHES} simultaneous watches.`);
    const receipts = asList(await getJson(LATEST_KEY)).filter((item) => item.watch?.target?.id?.toLowerCase() !== watch.target.id.toLowerCase());
    receipts.push(receipt);
    await setJson(WATCH_KEY, registrations);
    await setJson(LATEST_KEY, receipts);
    await pushJson(HISTORY_KEY, receipt, 50);
    return response.status(200).json({ ok: true, active: true, watchCount: registrations.length, registration: { registeredAt: registration.registeredAt, target: watch.target, sourceReceiptId: receipt.receiptId } });
  } catch (error) {
    return response.status(400).json({ ok: false, error: error.message });
  }
}
