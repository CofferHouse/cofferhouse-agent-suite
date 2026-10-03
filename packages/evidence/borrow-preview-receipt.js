import { sealDocument } from "./integrity.js";

export function createBorrowPreviewReceipt(preview) {
  if (preview?.schema !== "cofferhouse.arc-app-kits.borrow-preview.v1") throw new Error("A valid Borrow Kit preview is required.");
  return sealDocument({
    schema: "cofferhouse.arc-app-kits.borrow-preview-receipt.v1", generatedAt: preview.observedAt,
    sourceAgent: "CofferHouse Action Center · Arc Borrow Kit", sourceSchema: preview.schema,
    source: preview.source, chain: preview.chain, market: preview.market, borrowAmountUsdc: preview.borrowAmountUsdc,
    targetHealthFactor: preview.targetHealthFactor, requiredCollateral: preview.requiredCollateral,
    resultingHealthFactor: preview.resultingHealthFactor, healthFactorBand: preview.healthFactorBand,
    liquidationPrice: preview.liquidationPrice, warnings: preview.warnings, execution: preview.execution, notice: preview.notice
  }, "borrow-preview");
}
