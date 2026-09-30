import { timingSafeEqual } from "node:crypto";
import { durableStoreConfigured, getJson, listJson } from "../_redis.js";
import { deploymentCapabilities, evaluateDeploymentReadiness } from "../../packages/agent-core/index.js";

const STATUS_KEY = "cofferhouse:scout:agent-status";
const HISTORY_KEY = "cofferhouse:scout:agent-history";
const ACK_KEY = "cofferhouse:scout:latest-acknowledgment";
const ACK_HISTORY_KEY = "cofferhouse:scout:acknowledgment-history";
const RESEARCH_SESSION_KEY = "cofferhouse:agent-hub:latest-session";
const RESEARCH_HISTORY_KEY = "cofferhouse:agent-hub:session-history";
const GUARDIAN_WATCH_KEY = "cofferhouse:guardian:active-watch";
const GUARDIAN_LATEST_KEY = "cofferhouse:guardian:latest-receipt";
const GUARDIAN_HISTORY_KEY = "cofferhouse:guardian:receipt-history";
const INTEROP_LATEST_KEY = "cofferhouse:interop:latest-receipt";
const INTEROP_HISTORY_KEY = "cofferhouse:interop:receipt-history";

function runtimeCapabilities() {
  return { ...deploymentCapabilities(process.env), durableMemory: durableStoreConfigured() };
}

function bearerToken(request) {
  const header = String(request.headers?.authorization ?? "");
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function isDetailedStatusAuthorized(request, expected = process.env.SCOUT_OPERATOR_TOKEN) {
  const received = bearerToken(request);
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function publicStatus(status) {
  if (!status) return null;
  return {
    ranAt: status.ranAt ?? null,
    health: status.error ? "degraded" : "online",
    decision: status.decision?.action ? { action: status.decision.action } : null
  };
}

function emptyDetails() {
  return { history: [], acknowledgment: null, acknowledgments: [], researchSession: null, researchSessions: [], guardianRegistration: null, guardian: null, guardianHistory: [], interop: null, interopHistory: [] };
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ configured: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "no-store");
  const capabilities = runtimeCapabilities();
  const detailed = isDetailedStatusAuthorized(request);
  if (!durableStoreConfigured()) {
    return response.status(200).json({ configured: false, access: detailed ? "operator" : "public_summary", capabilities: detailed ? capabilities : undefined, deployment: detailed ? evaluateDeploymentReadiness({ capabilities }) : null, status: null, summaryCounts: null, ...emptyDetails() });
  }
  try {
    const [status, history, acknowledgment, acknowledgments, researchSession, researchSessions, guardianRegistration, guardian, guardianHistory, interop, interopHistory] = await Promise.all([getJson(STATUS_KEY), listJson(HISTORY_KEY, 10), getJson(ACK_KEY), listJson(ACK_HISTORY_KEY, 50), getJson(RESEARCH_SESSION_KEY), listJson(RESEARCH_HISTORY_KEY, 10), getJson(GUARDIAN_WATCH_KEY), getJson(GUARDIAN_LATEST_KEY), listJson(GUARDIAN_HISTORY_KEY, 10), getJson(INTEROP_LATEST_KEY), listJson(INTEROP_HISTORY_KEY, 10)]);
    const deployment = evaluateDeploymentReadiness({ capabilities, lastRunAt: status?.ranAt });
    if (!detailed) {
      return response.status(200).json({ configured: true, access: "public_summary", status: publicStatus(status), deployment: { status: deployment.status, ageMinutes: deployment.ageMinutes }, summaryCounts: { cycles: history.length, researchSessions: researchSessions.length, guardianReceipts: guardianHistory.length, interopReceipts: interopHistory.length }, ...emptyDetails() });
    }
    return response.status(200).json({ configured: true, access: "operator", capabilities, deployment, status, history, acknowledgment, acknowledgments, researchSession, researchSessions, guardianRegistration, guardian, guardianHistory, interop, interopHistory, summaryCounts: { cycles: history.length, researchSessions: researchSessions.length, guardianReceipts: guardianHistory.length, interopReceipts: interopHistory.length } });
  } catch (error) {
    return response.status(500).json({ configured: true, access: detailed ? "operator" : "public_summary", error: detailed ? error.message : "Runtime status is temporarily unavailable.", status: null, deployment: null, summaryCounts: null, ...emptyDetails() });
  }
}
