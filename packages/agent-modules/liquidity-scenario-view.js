import { escapeHtml as h } from "../shared/index.js";
export const defaultLiquidityScenario = Object.freeze({ capitalUsd: 1000, principalUsd: 1000, positionFeesUsd: 0, costsUsd: 0, holdingValueUsd: 1000, stressPrincipalUsd: 900, feeHaircutPct: 50, minProfitUsd: 10, maxStressLossPct: 5, horizonDays: 7 });
const fields = {
  horizonDays: "Scenario horizon (days)", capitalUsd: "Initial LP capital (USD)",
  principalUsd: "Final principal assumption, fees excluded (USD)",
  positionFeesUsd: "Position fee assumption (USD)", costsUsd: "Total entry, management and exit costs (USD)",
  holdingValueUsd: "Final value if original tokens were held (USD)",
  stressPrincipalUsd: "Adverse principal assumption (USD)", feeHaircutPct: "Adverse fee reduction (%)",
  minProfitUsd: "Target net profit (USD)", maxStressLossPct: "Maximum adverse capital loss (%)"
};
const dollars = value => value.toFixed(2) + " USD";
export function liquidityScenarioHtml(state) {
  return `<section class="gateway-panel lp-scenario" aria-labelledby="lp-scenario-title">
    <h3 id="lp-scenario-title">LP Strategy Lab · fees versus losses and costs</h3>
    <p>Enter assumptions for one position over the same horizon. Pool aggregate fees are not your position fees. This is a paper scenario, not a forecast.</p>
    <form class="lp-scenario-form meteora-form">${Object.entries(fields).map(([name,label]) => `<label><span>${h(label)}</span><input required name="${name}" type="number" min="${name === "capitalUsd" ? "0.01" : name === "horizonDays" ? "1" : "0"}" max="${name === "horizonDays" ? "365" : name.endsWith("Pct") ? "100" : "1000000000000"}" step="${name === "horizonDays" ? "1" : "0.01"}" value="${h(state.assumptions[name])}"></label>`).join("")}
      <button type="submit">EVALUATE LP SCENARIO</button>
    </form>
    ${state.error ? '<p role="status">Check the scenario assumptions.</p>' : ""}
    ${state.result ? `<div class="lp-scenario-result"><b>${state.result.decision === "WITHIN_PAPER_LIMITS" ? "Scenario meets research limits" : "Scenario misses research limits"}</b><dl>
      <div><dt>Net profit / loss</dt><dd>${h(dollars(state.result.netPnlUsd))}</dd></div>
      <div><dt>Difference versus holding</dt><dd>${h(dollars(state.result.versusHoldingUsd))}</dd></div>
      <div><dt>Adverse net profit / loss</dt><dd>${h(dollars(state.result.stressPnlUsd))}</dd></div>
      <div><dt>Position fees needed to meet the target and holding benchmark</dt><dd>${h(dollars(state.result.requiredPositionFeesUsd))}</dd></div>
      </dl><button class="lp-scenario-download" type="button">DOWNLOAD SEARCH RECEIPT</button></div>` : ""}
    <p>The model does not infer bin ranges, impermanent loss or future fees. Changing inputs can change the result; no transaction is authorized.</p>
  </section>`;
}
