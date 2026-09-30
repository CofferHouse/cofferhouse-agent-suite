import { sealDocument } from "./integrity.js";

export function createActionReceipt(preview, approval = null) {
  if (preview?.schema !== "cofferhouse.action.preview.v1") throw new Error("A valid action preview is required.");
  if (approval && approval.schema !== "cofferhouse.action.approval.v1") throw new Error("A valid Action Center approval is required.");
  return sealDocument({
    schema: "cofferhouse.action.receipt.v1",
    generatedAt: approval?.approvedAt ?? preview.createdAt,
    sourceAgent: "CofferHouse Action Center",
    preview,
    approval,
    execution: { prepared: false, signed: false, submitted: false, transactionHash: null },
    notice: "Tamper-evident decision artifact only. No executable transaction is contained in this receipt."
  }, "action");
}
