import { escapeHtml as h } from "../shared/index.js";
const dollars = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " USD" : "—";
const reasons = {
  TVL_BELOW_LIMIT_OR_UNKNOWN: "TVL is below the limit or unavailable.",
  VOLUME_BELOW_LIMIT_OR_UNKNOWN: "Volume is below the limit or unavailable.",
  BLACKLISTED_OR_UNKNOWN: "Pool blacklist status requires review.",
  TOKEN_FREEZE_CONTROL_UNVERIFIED: "Token freeze controls require review."
};

export function meteoraHtml(state) {
  const observation = state.observation;
  return `<section class="gateway-panel meteora-discovery" aria-labelledby="meteora-title">
    <h3 id="meteora-title">Solana · Meteora liquidity research</h3>
    <p>Scout screens a sample of up to 20 DLMM pools by TVL and activity. Matching filters is not safety approval.</p>
    <form class="meteora-form">
      <label><span>Minimum TVL (USD)</span><input name="minTvlUsd" type="number" min="0" max="1000000000000" step="0.01" value="${h(state.minTvlUsd)}"></label>
      <label><span>Minimum 24h volume (USD)</span><input name="minVolume24hUsd" type="number" min="0" max="1000000000000" step="0.01" value="${h(state.minVolume24hUsd)}"></label>
      <button type="submit" ${state.mode === "loading" ? "disabled" : ""}>SCAN METEORA POOLS</button>
    </form>
    <p role="status">${state.mode === "loading" ? "Checking Meteora…" : state.mode === "error" || observation?.status === "UNAVAILABLE" ? "Meteora data is unavailable. No pool recommendation was produced." : observation?.status === "NO_MATCH" ? "Meteora returned no pools." : ""}</p>
    ${observation?.status === "FOUND" ? `<p>${h(observation.sampled)} <span>pools sampled</span> · ${h(observation.matches)} <span>match filters; manual review required</span></p>
      <button class="meteora-download" type="button">DOWNLOAD SEARCH RECEIPT</button>
      <div class="vault-exposure-scroll"><table><thead><tr><th>Pool</th><th>TVL</th><th>24h volume</th><th>Pool fees 24h</th><th>Research status</th></tr></thead><tbody>${observation.candidates.map(pool => `<tr><td><b>${h(pool.tokenX.symbol)} / ${h(pool.tokenY.symbol)}</b><details><summary>Pool and token identities</summary><code>${h(pool.address)}</code><br><code>${h(pool.tokenX.mint)}</code><br><code>${h(pool.tokenY.mint)}</code><br><time>${h(pool.observedAt)}</time></details></td><td>${h(dollars(pool.tvlUsd))}</td><td>${h(dollars(pool.volume24hUsd))}</td><td>${h(dollars(pool.poolFees24hUsd))}</td><td><span>${pool.matchesFilters ? "Manual review required" : "Outside research filters"}</span>${pool.blockers.length ? `<ul>${pool.blockers.map(reason => `<li>${h(reasons[reason])}</li>`).join("")}</ul>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <p>Pool fees are aggregate historical fees, not your earnings. No position return, rug protection or entry/exit automation is claimed.</p>
  </section>`;
}
