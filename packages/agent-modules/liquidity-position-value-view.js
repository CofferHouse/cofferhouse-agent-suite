import { escapeHtml as h } from "../shared/index.js";
export function liquidityPositionValueHtml(value) {
  if (!value) return "";
  return `<section class="meteora-position-value"><h4>Position balance reference</h4>
    <p>Provider position balances and pending fees are shown separately. Pending fees and rewards are not added to the reference because their overlap is unverified.</p>
    <p><span>Position observation time</span>: <time>${h(value.positionObservedAt)}</time><br><span>History observation time</span>: <time>${h(value.historyObservedAt)}</time></p>
    <dl>${[["Provider token X balance (USD)",value.providerBalanceComponentsUsd.tokenX],["Provider token Y balance (USD)",value.providerBalanceComponentsUsd.tokenY],["Provider pending token X fees (USD)",value.providerPendingFeeComponentsUsd.tokenX],["Provider pending token Y fees (USD)",value.providerPendingFeeComponentsUsd.tokenY],["Cashflows plus provider balances, before costs (USD)",value.balanceOnlyReferenceUsd],["Cashflows plus provider balances, after entered costs (USD)",value.balanceOnlyReferenceAfterEnteredCostsUsd]].map(([label,amount]) => `<div><dt>${label}</dt><dd>${h(amount ?? "—")}</dd></div>`).join("")}</dl>
    ${value.reasons.includes("SNAPSHOT_WINDOW_EXCEEDED") || value.reasons.includes("EVENT_AFTER_POSITION_SNAPSHOT") ? '<p>Refresh the position, then reload its history. Their observation times or events do not align.</p>' : ""}
    ${value.reasons.includes("POSITION_BALANCES_UNKNOWN") ? '<p>Both provider balance values are required; missing values are not zero.</p>' : ""}
    ${value.reasons.includes("POSITION_STATE_UNCONFIRMED") || value.reasons.includes("CLOSED_POSITION_COMPONENTS_NONZERO") ? '<p>The position state or closed-position balances require review. No combined reference is shown.</p>' : ""}
    <p>This is an unverified balance-only reference, not realized profit or investment return. Two retrieval times do not prove atomic state or fresh prices.</p></section>`;
}
