import {escapeHtml as h} from "../shared/index.js";
export function solanaDiscoveryHtml(state) {
  const statuses={NOT_CONFIGURED:"Jupiter data access is not configured.",UNAVAILABLE:"Jupiter data is unavailable.",NO_MATCH:"No Jupiter Earn assets returned."};
  return `<section class="gateway-panel solana-discovery" aria-labelledby="solana-discovery-title">
    <h3 id="solana-discovery-title">Solana · Jupiter Lend research</h3>
    <button class="solana-refresh" type="button" ${state.mode==="loading" ? "disabled" : ""}>CHECK SOLANA LENDING</button>
    <p role="status">${state.mode==="loading" ? "Checking Jupiter…" : h(statuses[state.status] ?? "")}</p>
    ${state.tokens.length ? `<ul>${state.tokens.map(token=>`<li><b>${h(token.asset.symbol)}</b><br><span>Underlying mint</span>: <code>${h(token.asset.mint)}</code><br><span>Lending mint</span>: <code>${h(token.lendingMint)}</code><br><span>Observed at</span>: <time>${h(token.observedAt)}</time></li>`).join("")}</ul>` : ""}
    <p>Rates are not ranked until their units are verified. Deposits are not withdrawal liquidity. Research only.</p>
  </section>`;
}
