import { escapeHtml as h } from "../shared/index.js";
import { discoveryNetworks } from "../arc-data/morpho-discovery.js";

const labels = { FOUND: "Markets found", NO_MATCH: "No match in the scanned markets", UNAVAILABLE: "Data source unavailable" };
const number = (value, suffix = "") => Number.isFinite(value) ? value.toLocaleString(undefined, {maximumFractionDigits: 2}) + suffix : "—";

export function scoutDiscoveryHtml(state) {
  return `<section class="gateway-panel scout-discovery" aria-labelledby="scout-discovery-title">
    <h3 id="scout-discovery-title">Scout · lending across networks</h3>
    <p>Research only. Scout scans up to 20 listed Morpho markets per selected network, then applies your filters.</p>
    <p>Markets with missing data do not pass a filter on that metric.</p>
    <form class="scout-discovery-form">
      <fieldset><legend>Networks</legend>${discoveryNetworks.map(n => `<label><input type="checkbox" name="chain" value="${n.id}" ${state.chains.includes(n.id) ? "checked" : ""}> ${n.name}</label>`).join("")}</fieldset>
      <label><span>Loan asset symbol or contract address</span><input name="asset" maxlength="42" value="${h(state.asset)}"></label>
      <label><span>Minimum available liquidity (USD)</span><input name="minLiquidityUsd" type="number" min="0" max="9007199254740991" step="0.01" value="${h(state.minLiquidityUsd ?? "")}"></label>
      <label><span>Maximum utilization (%)</span><input name="maxUtilizationPct" type="number" min="0" max="100" step="0.01" value="${h(state.maxUtilizationPct ?? "")}"></label>
      <button type="submit" ${state.mode === "loading" ? "disabled" : ""}>SEARCH LENDING MARKETS</button>
    </form>
    <p role="status">${state.mode === "loading" ? "Checking markets…" : state.mode === "error" ? "Could not search. Check your filters and retry." : ""}</p>
    ${state.receipt ? '<button type="button" class="scout-discovery-download">DOWNLOAD SEARCH RECEIPT</button>' : ""}
    ${state.networks.map(network => `<details open><summary>${h(network.name)} · <span>${h(labels[network.status] ?? labels.UNAVAILABLE)}</span></summary>
      ${network.observedAt ? `<p><span>Observed at</span>: <time>${h(network.observedAt)}</time> · ${h(network.scanned)} <span>markets scanned</span></p>` : ""}
      ${network.markets.length ? `<div class="vault-exposure-scroll"><table><thead><tr><th>Loan asset</th><th>Collateral</th><th>Supply APY</th><th>Available liquidity</th><th>Utilization</th></tr></thead><tbody>
      ${network.markets.map(m => `<tr><td><strong>${h(m.asset.symbol)}</strong><details><summary>Market identity</summary><code>${h(m.id)}</code><br><code>${h(m.asset.address)}</code></details></td><td>${h(m.collateral?.symbol ?? "—")}</td><td>${h(number(m.supplyApyPct, "%"))}</td><td>${h(number(m.liquidityUsd, " USD"))}</td><td>${h(number(m.utilizationPct, "%"))}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
    </details>`).join("")}
    <p>Reported APY is variable. Listing is not approval. No wallet connection, transfers or monitoring are enabled here.</p>
  </section>`;
}
