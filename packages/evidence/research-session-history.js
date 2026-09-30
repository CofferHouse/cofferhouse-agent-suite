import { verifyReceiptDocument } from "./receipt-registry.js";

const STORAGE_KEY = "cofferhouse.agent-hub.session-history.v1";
const MAX_ENTRIES = 10;

const isValidSessionReceipt = (receipt) => receipt?.schema === "cofferhouse.agent-hub.session-receipt.v1"
  && verifyReceiptDocument(receipt).valid;

export function loadResearchSessionHistory(storage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isValidSessionReceipt).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function saveResearchSessionHistory(storage, history) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(history.filter(isValidSessionReceipt).slice(0, MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

export function addResearchSessionReceipt(history, receipt) {
  if (!isValidSessionReceipt(receipt)) throw new Error("A valid Agent Hub session receipt is required.");
  return [receipt, ...history.filter((item) => item.receiptId !== receipt.receiptId)].slice(0, MAX_ENTRIES);
}

export function clearResearchSessionHistory(storage) {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* Keep the in-memory reset. */ }
  return [];
}

export function researchSessionFromReceipt(receipt) {
  if (!isValidSessionReceipt(receipt)) throw new Error("A valid Agent Hub session receipt is required.");
  const { receiptId, integrity, sourceAgent, schema, ...session } = receipt;
  return { schema: "cofferhouse.agent-hub.session.v1", ...session };
}

export function compareResearchSessions(current, previous) {
  if (!isValidSessionReceipt(current) || !isValidSessionReceipt(previous)) return null;
  const fields = ["marketsObserved", "marketsEligible", "lendingPositions", "dexPoolsObserved", "dexPoolsEligible", "dexPositions"];
  const changes = Object.fromEntries(fields.map((field) => [field, Number(current.summary[field] ?? 0) - Number(previous.summary[field] ?? 0)]));
  return {
    currentReceiptId: current.receiptId,
    previousReceiptId: previous.receiptId,
    decisionChanged: current.summary.decision !== previous.summary.decision,
    previousDecision: previous.summary.decision,
    currentDecision: current.summary.decision,
    changes
  };
}
