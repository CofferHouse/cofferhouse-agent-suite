import { verifySealedDocument } from "./integrity.js";
export const receiptSchemas = Object.freeze([
  "cofferhouse.scout.receipt.v2", "cofferhouse.scout.simulation-receipt.v2",
  "cofferhouse.opportunity.receipt.v1", "cofferhouse.arc-app-kits.earn-receipt.v1", "cofferhouse.strategy.receipt.v1",
  "cofferhouse.dex.pool-receipt.v1", "cofferhouse.dex.opportunity-receipt.v1",
  "cofferhouse.dex.strategy-receipt.v1", "cofferhouse.action.receipt.v1",
  "cofferhouse.guardian.receipt.v1", "cofferhouse.automation.receipt.v1",
  "cofferhouse.agent-hub.session-receipt.v1", "cofferhouse.interop.receipt.v1"
]);
const supported = new Set(receiptSchemas);
export function isSupportedReceiptSchema(schema) { return supported.has(schema); }
export function verifyReceiptDocument(document) {
  if (!isSupportedReceiptSchema(document?.schema)) return { valid: false, reason: "Unsupported or missing CofferHouse receipt schema." };
  return { ...verifySealedDocument(document), schema: document.schema, receiptId: document.receiptId };
}
