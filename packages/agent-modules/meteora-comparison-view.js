import { escapeHtml as h } from "../shared/index.js";
import { sealDocument } from "../evidence/integrity.js";
import { compareMeteoraPositionReceipts } from "./meteora-position-comparison.js";
export function currentPositionReceipt(observation) {
  return sealDocument({ schema: "cofferhouse.meteora.position-receipt.v1", generatedAt: observation.observedAt, observation }, "meteora-position");
}
export function positionComparison(state, observation) {
  if (!state.receipt || !observation) return { result: null, error: false };
  try { return { result: compareMeteoraPositionReceipts(state.receipt, currentPositionReceipt(observation)), error: false }; }
  catch { return { result: null, error: true }; }
}
export function meteoraComparisonHtml(state, observation) {
  const { result, error } = positionComparison(state, observation);
  const flowLabels = { CHANGED: "Provider deposit or withdrawal totals changed.", NO_CHANGE_OBSERVED: "No change observed in provider deposit and withdrawal totals.", UNKNOWN: "Capital flow changes could not be confirmed.", COUNTER_DECREASED: "Provider totals decreased; review corrections before interpreting changes." };
  return `<section class="gateway-panel meteora-comparison" aria-labelledby="meteora-comparison-title"><h3 id="meteora-comparison-title">Compare LP observations</h3>
    <p>Import a previous position receipt or save the current observation as a baseline. Comparison runs in this tab; no file is uploaded or stored after reload.</p>
    <label><span>Previous position receipt (JSON, up to 32 KB)</span><input class="meteora-baseline-file" type="file" accept="application/json,.json"></label>
    ${observation ? '<button class="meteora-save-baseline" type="button">USE CURRENT OBSERVATION AS BASELINE</button>' : ""}
    ${state.receipt ? `<p><span>Baseline observation</span>: <time>${h(state.receipt.observation.observedAt)}</time></p><button class="meteora-clear-baseline" type="button">CLEAR BASELINE</button>` : ""}
    <p role="status">${state.error ? "Invalid position receipt. Check its integrity, identities and required data." : error ? "Use a later observation of the same position, wallet and token mints." : state.receipt && !observation ? "Baseline ready. Look up the same position to compare." : ""}</p>
    ${result ? `<div class="lp-scenario-result"><p>${h(result.beforeObservedAt)} → ${h(result.afterObservedAt)}</p><dl>${[["Provider PnL change (USD)","providerPnlUsd"],["Provider lifetime fee change (USD)","providerAllTimeFeesUsd"],["Provider deposit total change (USD)","providerDepositsUsd"],["Provider withdrawal total change (USD)","providerWithdrawalsUsd"]].map(([label,key]) => `<div><dt>${label}</dt><dd>${h(result.providerChangesUsd[key] ?? "—")}</dd></div>`).join("")}</dl>
      <p>${h(flowLabels[result.capitalFlowState])}</p><p><span>Range status before / after</span>: <code>${h(result.range.before)} / ${h(result.range.after)}</code></p>
      ${result.range.boundsChanged ? '<p>Position bin boundaries changed.</p>' : ""}
      ${result.warnings.includes("PROVIDER_COUNTER_DECREASED") ? '<p>Provider totals decreased; review corrections before interpreting changes.</p>' : ""}
      <button class="meteora-comparison-download" type="button">DOWNLOAD COMPARISON RECEIPT</button></div>` : ""}
    <p>These are provider data changes, not realized profit or investment returns. Fees and PnL are not added. Costs and the holding benchmark remain unknown. Receipt integrity does not authenticate the source.</p></section>`;
}
