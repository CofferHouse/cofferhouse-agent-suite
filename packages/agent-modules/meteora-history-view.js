import { liquidityPositionValueHtml } from "./liquidity-position-value-view.js";
import { escapeHtml as h } from "../shared/index.js";
import { sealDocument } from "../evidence/integrity.js";
export function currentHistoryReceipt(history) {
  return sealDocument({ schema: "cofferhouse.meteora.history-receipt.v1", generatedAt: history.observedAt, history }, "meteora-history");
}
export function meteoraHistoryHtml(state, observation) {
  const matching = observation && state.forObservationAt === observation.observedAt && ["pool", "position"].every(k => state.history?.target?.[k] === observation[k]) && state.history?.target?.user === observation.queriedUser;
  const history = matching ? state.history : null;
  const found = history?.status === "FOUND";
  const signatures = found ? [...new Set(history.events.map(e => e.signature))] : [];
  const cost = signature => state.costs?.find(c => c.signature === signature)?.usd ?? "";
  const labels = { add: "Liquidity added", remove: "Liquidity removed", claim_fee: "Fees claimed", claim_reward: "Rewards claimed", UNKNOWN: "Unknown event" };
  const statuses = { NOT_OBSERVED: "No indexed events were returned. This does not prove there was no activity.", LIMIT_EXCEEDED: "History exceeds the 200-event or response-size limit. No partial accounting was produced.", UNAVAILABLE: "Position history is unavailable." };
  return `<section class="gateway-panel meteora-history" aria-labelledby="meteora-history-title"><h3 id="meteora-history-title">LP history and transaction costs</h3>
    <p>Load indexed events for the current position. This sends its public position key to Meteora, without a signature or wallet connection.</p>
    <button class="meteora-history-load" type="button" ${!observation || state.mode === "loading" ? "disabled" : ""}>LOAD POSITION HISTORY</button>
    <p role="status">${state.mode === "loading" ? "Loading position history…" : state.mode === "error" ? "Position history is unavailable." : h(statuses[history?.status] ?? "")}</p>
    ${history && ["FOUND", "NOT_OBSERVED"].includes(history.status) ? '<button class="meteora-history-download" type="button">DOWNLOAD HISTORY RECEIPT</button>' : ""}
    ${found ? `<p><span>Observed at</span>: ${h(history.observedAt)} · ${history.events.length} <span>indexed events</span></p><p>History completeness, event valuations and token units are unverified. Provider PnL and lifetime fees are not added to these events.</p>
      <div class="meteora-history-table"><table><thead><tr><th>Event</th><th>Block time</th><th>Indexed value (USD)</th><th>Transaction</th></tr></thead><tbody>${history.events.slice(0,30).map(e => `<tr><td>${labels[e.type]}</td><td>${h(new Date(e.blockTime*1000).toISOString())}</td><td>${h(e.indexedValueUsd ?? "—")}</td><td><code>${h(e.signature.slice(0,12))}…</code> #${h(e.ixIndex)}</td></tr>`).join("")}</tbody></table></div><p>Showing up to 30 events. The receipt contains all returned events within the limit.</p>
      <form class="meteora-cost-form"><p>Enter only external transaction costs allocated to this position, once per transaction. Do not repeat costs already included in event values. Blank means unknown; enter 0 only when confirmed.</p>
        <details><summary>Transaction cost entries</summary>${signatures.map(signature => `<label><code>${h(signature)}</code><span>Allocated external cost (USD)</span><input name="${h(signature)}" inputmode="decimal" maxlength="51" autocomplete="off" value="${h(cost(signature))}"></label>`).join("")}</details><button type="submit">CALCULATE OBSERVED CASHFLOWS</button></form>
      <p class="meteora-cost-status" role="status">${state.costError ? "Check the transaction costs. Use nonnegative USD decimal values." : ""}</p>
      ${state.cashflows ? `<div class="lp-scenario-result meteora-cashflow-result"><dl>${[["Observed deposits (USD)",state.cashflows.groups.add.usd],["Observed withdrawals (USD)",state.cashflows.groups.remove.usd],["Observed fee claims (USD)",state.cashflows.groups.claim_fee.usd],["Observed reward claims (USD)",state.cashflows.groups.claim_reward.usd],["Indexed cashflow balance before costs (USD)",state.cashflows.indexedCashflowBalanceUsd],["Entered external costs (USD)",state.cashflows.providedCostsUsd],["Indexed balance after entered costs (USD)",state.cashflows.indexedBalanceAfterEnteredCostsUsd]].map(([label,value]) => `<div><dt>${label}</dt><dd>${h(value ?? "—")}</dd></div>`).join("")}</dl>
      <p>${state.cashflows.costCoverage === "MISSING_TRANSACTION_COSTS" ? "Some observed transactions have no cost entry; an adjusted balance is not shown." : "Costs were entered for all observed transactions; they are not independently verified."}</p>${liquidityPositionValueHtml(state.cashflows.positionValue)}<button class="meteora-cashflow-download" type="button">DOWNLOAD CASHFLOW RECEIPT</button></div>` : ""}` : ""}
    <p>A negative cashflow balance can mean capital is still in the position.</p>
    <p>Indexed cashflows exclude current position value. The optional balance-only reference is separate and unverified. Complete history, prices and costs still require reconciliation; no transaction or scheduled monitoring is started.</p></section>`;
}
