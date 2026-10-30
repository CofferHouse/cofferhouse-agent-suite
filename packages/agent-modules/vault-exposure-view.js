import { escapeHtml as h } from "../shared/index.js";
import { formatVaultUnits } from "../arc-data/vault-exposure.js";

export function vaultExposureHtml(state) {
  if (!state) return "";
  if (state.mode === "loading") return '<section class="vault-exposure-panel" aria-live="polite"><p>Loading vault allocations…</p></section>';
  if (state.mode === "error") return '<section class="vault-exposure-panel" aria-live="polite"><p>Vault allocations are unavailable. No exposure is assumed to be zero.</p></section>';
  const data = state.observation;
  const amount = value => formatVaultUnits(value, data.asset.decimals) ?? "Unavailable";
  return `<section class="vault-exposure-panel" aria-live="polite">
    <h4>Where does this vault allocate?</h4>
    <p><code>${h(data.vaultAddress)}</code> · Morpho V${data.version} · ${h(data.asset.symbol)}</p>
    <p>${data.status === "INDEXED_OBSERVATION" ? "Indexed observation" : "Partial evidence"}</p>
    <dl><dt>Owner</dt><dd><code>${h(data.roles.owner ?? "Unavailable")}</code></dd>
    <dt>Curator</dt><dd><code>${h(data.roles.curator ?? "Unavailable")}</code></dd>
    <dt>Total assets</dt><dd>${h(amount(data.totalAssetsUnits))} ${h(data.asset.symbol)}</dd>
    <dt>Available to withdraw</dt><dd>${h(amount(data.withdrawableAssetsUnits))} ${h(data.asset.symbol)}</dd>
    <dt>Idle assets</dt><dd>${h(amount(data.idleAssetsUnits))} ${h(data.asset.symbol)}</dd>
    <dt>Source blocks</dt><dd><code>${h(Object.values(data.sourceBlocks).map(value => value ?? "?").join(" / "))}</code></dd></dl>
    <div class="vault-exposure-scroll"><table><thead><tr><th>Market or adapter</th><th>Allocated assets</th><th>Share of vault</th></tr></thead><tbody>
    ${data.positions.map(item => `<tr><td><code>${h(item.id)}</code></td><td>${h(amount(item.allocatedUnits))} ${h(data.asset.symbol)}</td><td>${item.sharePct === null ? "—" : `${h(item.sharePct)}%`}</td></tr>`).join("")}
    </tbody></table></div>
    <p>${state.comparison?.status === "REVIEW" ? "Changes detected since the previous comparable observation." : state.comparison?.status === "NO_OBSERVED_CHANGE" ? "No monitored change detected between comparable observations." : "Comparison requires two reconciled observations from increasing blocks."}</p>
    ${state.comparison?.changes?.length ? `<ul>${state.comparison.changes.map(change => `<li><code>${h(change.kind)}${change.role ? ` (${h(change.role)})` : ""}</code>: <code>${h(String(change.before))} → ${h(String(change.after))}</code></li>`).join("")}</ul>` : ""}
    <ul>${data.warnings.concat(data.limitations).map(warning => `<li>${h(warning)}</li>`).join("")}</ul>
    <button class="vault-exposure-download" type="button">DOWNLOAD VAULT EVIDENCE</button>
  </section>`;
}
