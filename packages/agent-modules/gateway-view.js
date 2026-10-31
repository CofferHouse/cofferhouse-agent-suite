import { escapeHtml as h } from "../shared/index.js";
import { gatewayAmount } from "../arc-data/gateway.js";

export function gatewayHtml(state, walletAddress = null) {
  const observation = state.observation;
  return `<section class="gateway-panel" aria-labelledby="gateway-title">
    <h3 id="gateway-title">Gateway · balances by asset</h3>
    <p>Check supported funding networks and confirmed Gateway deposits. Each asset keeps its own balance.</p>
    <button class="gateway-refresh" type="button" ${state.mode === "loading" ? "disabled" : ""}>CHECK NETWORK SUPPORT</button>
    <button class="gateway-balances" type="button" ${state.mode === "loading" || !walletAddress ? "disabled" : ""}>CHECK CONNECTED WALLET BALANCES</button>
    ${state.mode === "loading" ? '<p role="status">Checking Gateway…</p>' : ""}
    ${state.mode === "error" ? '<p role="status">Gateway is unavailable. Unknown balances are not zero.</p>' : ""}
    ${observation ? `<p><span>Observed at</span> <time>${h(observation.observedAt)}</time></p>
      ${observation.depositor ? `<p><span>Queried address</span>: <code>${h(observation.depositor)}</code></p>` : ""}
      <div class="gateway-assets">${observation.assets.map(asset => `<article><h4>${h(asset.token)}</h4>
        <p><span>Confirmed Gateway deposits</span>: <code>${h(gatewayAmount(asset.confirmedUnits, asset.decimals) ?? "—")} ${h(asset.token)}</code></p>
        <p>${asset.status === "UNAVAILABLE" || asset.status === "PARTIAL_EVIDENCE" ? "Balance evidence is incomplete." : asset.status === "NOT_REQUESTED" ? "Balance not requested." : "Requested balances returned."}</p>
        <p><span>API-supported sources to Arc</span>: <span data-no-translate>${h(asset.routes.filter(route => route.status === "SUPPORTED_BY_API").map(route => route.chain).join(", ") || "—")}</span></p>
        ${asset.balances.length ? `<details><summary>Balances by source network</summary><ul>${asset.balances.map(balance => `<li><span data-no-translate>${h(balance.chain)}</span>: <code>${h(gatewayAmount(balance.confirmedUnits, asset.decimals) ?? "—")} ${h(asset.token)}</code></li>`).join("")}</ul></details>` : ""}
      </article>`).join("")}</div>
      <ul>${observation.limitations.map(item => `<li>${h(item)}</li>`).join("")}</ul>
      <button class="gateway-download" type="button">DOWNLOAD GATEWAY EVIDENCE</button>` : ""}
    <p>Read only. No deposit, transfer or conversion is enabled.</p>
  </section>`;
}
