import { escapeHtml as h } from "../shared/index.js";
const amount = value => value === null || value === undefined ? "—" : value;
const labels = { IN_RANGE: "Price is within the position range", OUT_OF_RANGE: "Price is outside the position range; review required", UNKNOWN: "Position range could not be confirmed", CLOSED: "Position is closed" };
export function meteoraPositionHtml(state) {
  const observation = state.result?.observation;
  const statuses = { UNAVAILABLE: "Position data is unavailable.", NOT_OBSERVED: "The position was not observed for this pool and wallet. This does not prove it is closed.", NOT_FOUND_IN_SAMPLE: "The position was not found in the first 60 results. More positions may exist." };
  return `<section class="gateway-panel meteora-position" aria-labelledby="meteora-position-title">
    <h3 id="meteora-position-title">Meteora · inspect an LP position</h3>
    <p>Lookup sends these public addresses to Meteora. It does not connect your wallet or request a signature.</p>
    <form class="meteora-position-form meteora-form">${[["pool","Pool public key"],["user","Wallet public key"],["position","Position public key"]].map(([name,label]) => `<label><span>${label}</span><input name="${name}" required minlength="32" maxlength="44" autocomplete="off" spellcheck="false" value="${h(state[name])}"></label>`).join("")}
      <button type="submit" ${state.mode === "loading" ? "disabled" : ""}>LOOK UP LP POSITION</button>
    </form>
    <p role="status">${state.mode === "loading" ? "Checking position…" : state.mode === "error" ? "Check the public keys or try again." : h(statuses[state.result?.status] ?? "")}</p>
    ${observation ? `<div class="lp-scenario-result"><b>${h(labels[observation.range.state])}</b><p><span>Lower / active / upper bin</span>: ${h(amount(observation.range.lowerBinId))} / ${h(amount(observation.range.activeBinId))} / ${h(amount(observation.range.upperBinId))}</p>
      <dl><div><dt>Provider-reported PnL (USD)</dt><dd>${h(amount(observation.providerPnlUsd))}</dd></div><div><dt>Provider-reported lifetime fees (USD)</dt><dd>${h(amount(observation.providerAllTimeFeesUsd))}</dd></div>
      <div><dt>Provider-reported deposits / withdrawals (USD)</dt><dd>${h(amount(observation.providerDepositsUsd))} / ${h(amount(observation.providerWithdrawalsUsd))}</dd></div></dl>
      ${[observation.tokenX,observation.tokenY].map(token => `<details><summary><span>Position token</span>: <code>${h(token.mint ?? "—")}</code></summary><dl><div><dt>Principal amount (provider units)</dt><dd>${h(amount(token.principalAmount))}</dd></div><div><dt>Unclaimed fee amount (provider units)</dt><dd>${h(amount(token.unclaimedFeeAmount))}</dd></div></dl></details>`).join("")}
      <p><span>Observed at</span>: <time>${h(observation.observedAt)}</time></p><button class="meteora-position-download" type="button">DOWNLOAD SEARCH RECEIPT</button></div>` : ""}
    <p>These figures are kept separate to avoid double-counting fees. Costs and the holding benchmark are not reconciled. This lookup does not start scheduled monitoring.</p>
  </section>`;
}
