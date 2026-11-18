import { normalizeMeteoraHistory, METEORA_HISTORY_SOURCE, METEORA_HISTORY_LIMIT } from "../arc-data/meteora-history.js";
import { decimalUnits, decimalText } from "../shared/decimal-usd.js";
import { verifySealedDocument } from "../evidence/integrity.js";
export const MAX_HISTORY_RECEIPT_BYTES = 524288;
export function evaluateLiquidityCashflows(receipt, costs = []) {
  if (!receipt || receipt.schema !== "cofferhouse.meteora.history-receipt.v1" || new TextEncoder().encode(JSON.stringify(receipt)).length > MAX_HISTORY_RECEIPT_BYTES || !verifySealedDocument(receipt).valid) throw Error("INVALID_HISTORY_RECEIPT");
  if (typeof receipt.generatedAt !== "string" || !Number.isFinite(Date.parse(receipt.generatedAt)) || new Date(receipt.generatedAt).toISOString() !== receipt.generatedAt) throw Error("INVALID_HISTORY_RECEIPT");
  const history = receipt.history;
  if (history?.schema !== "cofferhouse.meteora.history-observation.v1" || history.status !== "FOUND" || history.tokenAmountUnitsVerified !== false || history.source !== METEORA_HISTORY_SOURCE || history.onchainVerified !== false || history.coverage !== "UNVERIFIED" || !history.events?.length) throw Error("INVALID_HISTORY_RECEIPT");
  const normalized = normalizeMeteoraHistory({ events: history.events }, history.target, history.observedAt);
  const signatures = [...new Set(normalized.events.map(e => e.signature))];
  if (!Array.isArray(costs) || costs.length > METEORA_HISTORY_LIMIT) throw Error("INVALID_COSTS");
  const seenCosts = new Map();
  for (const cost of costs) {
    if (!cost || typeof cost !== "object" || Object.keys(cost).some(k => !["signature", "usd"].includes(k)) || !signatures.includes(cost.signature) || seenCosts.has(cost.signature) || decimalUnits(cost.usd) === null) throw Error("INVALID_COSTS");
    seenCosts.set(cost.signature, decimalUnits(cost.usd));
  }
  const groupUnits = {};
  const groups = Object.fromEntries(["add", "remove", "claim_fee", "claim_reward"].map(type => {
    const events = normalized.events.filter(event => event.type === type);
    const values = events.map(e => decimalUnits(e.indexedValueUsd));
    groupUnits[type] = values.some(v => v === null) ? null : values.reduce((a,b) => a+b,0n);
    return [type, { count: events.length, usd: decimalText(groupUnits[type]) }];
  }));
  const values = groupUnits;
  const known = normalized.events.every(event => event.type !== "UNKNOWN") && Object.values(values).every(v => v !== null);
  const balance = known ? values.remove + values.claim_fee + values.claim_reward - values.add : null;
  const costsComplete = signatures.every(signature => seenCosts.has(signature));
  const providedCost = [...seenCosts.values()].reduce((a,b) => a+b,0n);
  return {
    schema: "cofferhouse.liquidity.indexed-cashflows.v1", historyReceiptId: receipt.receiptId,
    target: normalized.target, observedAt: normalized.observedAt, sourceAuthenticated: false, coverage: "UNVERIFIED",
    groups, eventCount: normalized.events.length, transactionCount: signatures.length,
    indexedCashflowBalanceUsd: decimalText(balance), providedCostsUsd: decimalText(providedCost), costedTransactions: seenCosts.size,
    costCoverage: costsComplete ? "ALL_OBSERVED_TRANSACTIONS_ENTERED" : "MISSING_TRANSACTION_COSTS",
    indexedBalanceAfterEnteredCostsUsd: balance !== null && costsComplete ? decimalText(balance - providedCost) : null,
    costs: costs.map(cost => ({ signature: cost.signature, usd: cost.usd })), costsVerified: false,
    warnings: [...new Set([...(history.warnings ?? []).filter(w => typeof w === "string" && w.length < 80), ...normalized.warnings, "HISTORY_COMPLETENESS_UNVERIFIED", "EVENT_SEMANTICS_UNVERIFIED", "CURRENT_POSITION_VALUE_NOT_INCLUDED", "USER_ENTERED_COSTS_UNVERIFIED", ...(!costsComplete ? ["TRANSACTION_COSTS_MISSING"] : [])])],
    realizedProfitUsd: null, netReturnPct: null, costAdjustedPnlUsd: null, holdingBenchmarkUsd: null,
    execution: { enabled: false, signed: false, submitted: false },
    notice: "Arithmetic over observed add/remove/claim event USD values minus separately entered external transaction costs. This is not realized profit or net investment return: current position value, complete history, historical price semantics and transaction-level reconciliation remain unverified. Do not enter fees or costs already included in event values. Allocate each transaction's external cost once to this position; no whole-wallet cost attribution is inferred."
  };
}
