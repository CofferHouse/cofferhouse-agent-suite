import { escapeHtml as h } from '../shared/index.js';
import { idleSourceReviewHtml } from './idle-source-review-view.js';

const labels = { wallet: 'Wallet USDC', protected: 'Protected cash', available: 'Cash after commitments', modeled: 'Modeled allocation before checks', reviewable: 'Amount available for manual review', liquidity: 'Exit liquidity used in scenario', cap: 'Maximum scenario allocation (USDC)', costs: 'Entered entry and exit costs', gross: 'Gross rate scenario', net: 'Net scenario after entered costs' };
const issueLabels = { INCOMPLETE_SCENARIO: 'One scenario is incomplete; differences are hidden.', DIFFERENT_WALLET_BALANCE: 'Initial wallet balances differ; differences are hidden.', DIFFERENT_HOLDING_WINDOW: 'The times until funds are needed differ; differences are hidden.', SAME_SNAPSHOT: 'Both slots contain the same snapshot; differences are hidden.' };
function slot(receipt, name) {
  if (!receipt) return '<article><h4>' + name + '</h4><p>No saved scenario.</p></article>';
  const p = receipt.scenario;
  const bps = p.assumptions.scenarioAnnualSimpleRateBps;
  const rate = Number.isInteger(bps) ? Math.floor(bps / 100) + '.' + String(bps % 100).padStart(2, '0') : '—';
  return '<article><h4>' + name + '</h4><p>' + (p.decision === 'KEEP_LIQUID' ? 'Keep funds liquid' : 'Review required at capture') + '</p>' +
    '<dl><div><dt>Captured at (UTC)</dt><dd data-no-translate>' + h(receipt.generatedAt) + '</dd></div>' +
    '<div><dt>Time until funds are needed (hours)</dt><dd data-no-translate>' + h(p.assumptions.holdingHours ?? '—') + '</dd></div>' +
    '<div><dt>Modeled earning hours</dt><dd data-no-translate>' + h(p.earningHours ?? '—') + '</dd></div></dl>' +
    '<dl><div><dt>Annual simple rate for this scenario (%)</dt><dd data-no-translate>' + h(rate) + '</dd></div></dl>' +
    '<p>' + (receipt.inputSource.includes('SYNTHETIC') ? 'Includes synthetic cash assumptions.' : 'Cash figures are user estimates.') + '</p>' +
    (p.marketSource ? '<p>Captured Earn liquidity source</p><p data-no-translate>' + h(p.marketSource.name) + ' · ' + h(p.marketSource.vaultAddress) + '</p><p data-no-translate>' + h(p.marketSource.retrievedAt) + '</p>' : '<p>Manual liquidity assumption</p>') +
    '<details><summary>Saved scenario identifier</summary><code>' + h(receipt.receiptId) + '</code></details></article>';
}
export function idleCapitalComparisonHtml(saved) {
  const comparison = saved.receipt?.comparison;
  return '<section class="idle-comparison" aria-labelledby="idle-comparison-title"><h3 id="idle-comparison-title">Saved USDC scenarios</h3>' +
    '<p>Saved snapshots stay in this page session. They do not refresh Earn or authorize an investment.</p>' +
    '<div class="idle-scenario-imports"><p>Open an original USDC scenario JSON file, up to 64 kB. It is checked locally and loaded only as saved history.</p>' + ['a','b'].map(key => '<label><span>' + (key === 'a' ? 'OPEN SCENARIO A' : 'OPEN SCENARIO B') + '</span><input class="idle-scenario-import" data-slot="' + key + '" type="file" accept=".json,application/json"></label><p class="idle-scenario-import-status" data-slot="' + key + '" role="status">' + ({loading:'Checking scenario file…',loaded:'Historical scenario loaded. Its original dates remain unchanged.',error:'Scenario file rejected. The saved slot is unchanged.'}[saved.importStatus?.[key]] ?? '') + '</p>').join('') + '<p>Integrity checks do not authenticate the figures or their author. Comparison and review files are not accepted here.</p></div>' +
    '<div class="idle-comparison-slots">' + slot(saved.a, 'Scenario A') + slot(saved.b, 'Scenario B') + '</div>' +
    (saved.error ? '<p role="status">Recalculate the scenario before saving it again.</p>' : '') +
    (comparison ? '<p class="idle-comparison-summary">' + (comparison.status === 'ARITHMETIC_COMPARISON_ONLY' ? 'Arithmetic differences only; no investment ranking.' : 'Scenarios are not comparable on the same basis.') + '</p>' +
      (comparison.issues.length ? '<ul>' + comparison.issues.map(issue => '<li>' + h(issueLabels[issue]) + '</li>').join('') + '</ul>' : '') +
      (comparison.inputsDiffer ? '<p>The scenarios use different data origins. Review both sources.</p>' : '') +
      '<table class="idle-comparison-table"><caption>USDC amounts; differences are B minus A.</caption><thead><tr><th scope="col">Measure</th><th scope="col">Scenario A</th><th scope="col">Scenario B</th><th scope="col">B minus A</th></tr></thead><tbody>' + comparison.rows.map(row => '<tr><th scope="row">' + h(labels[row.id]) + '</th>' + [['Scenario A', row.aUsdc], ['Scenario B', row.bUsdc], ['B minus A', row.deltaBMinusAUsdc]].map(([label, value]) => '<td><span class="idle-comparison-cell-label">' + label + '</span><span data-no-translate>' + h(value ?? '—') + '</span></td>').join('') + '</tr>').join('') + '</tbody></table>' +
      '<button type="button" class="idle-comparison-download">DOWNLOAD SCENARIO COMPARISON</button>' : '') +
    (saved.a || saved.b ? '<button type="button" class="idle-comparison-clear">CLEAR SAVED SCENARIOS</button>' : '') + idleSourceReviewHtml(saved) + '</section>';
}
