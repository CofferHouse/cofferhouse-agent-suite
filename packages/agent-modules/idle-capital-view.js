import { escapeHtml as h } from '../shared/index.js';
import { planIdleUsdc } from './idle-capital.js';
import { createIdleCapitalReceipt } from '../evidence/idle-capital-receipt.js';
import { earnLiquiditySource, earnLiquiditySources, earnSourceIssues, planIdleUsdcWithEarn } from './idle-capital-earn.js';
import { captureIdleCapitalScenario } from './idle-capital-comparison.js';
import { createIdleCapitalComparisonReceipt } from '../evidence/idle-capital-comparison-receipt.js';
import { idleCapitalComparisonHtml } from './idle-capital-comparison-view.js';

export const idleCapitalFields = Object.freeze([
  { title: 'Cash and commitments', fields: [
    ['walletUsdc', 'Wallet USDC'],
    ['reserveUsdc', 'Operating reserve (USDC)'],
    ['committedUsdc', 'Pending payment obligations (USDC)'],
    ['earmarkedUsdc', 'Other earmarked cash (USDC)'],
    ['maxAllocationUsdc', 'Maximum scenario allocation (USDC)'],
  ] },
  { title: 'Vault and rate assumptions', fields: [
    ['vaultAvailableLiquidityUsdc', 'Assumed available exit liquidity (USDC)'],
    ['maxLiquiditySharePct', 'Maximum share of exit liquidity (%)', 'percent'],
    ['scenarioAnnualSimpleRatePct', 'Annual simple rate for this scenario (%)', 'percent'],
  ] },
  { title: 'Time and costs', fields: [
    ['holdingHours', 'Time until funds are needed (hours)', 'hours'],
    ['withdrawalLeadHours', 'Withdrawal time allowance (hours)', 'hours'],
    ['entryCostUsdc', 'Total entry cost estimate (USDC)'],
    ['exitCostUsdc', 'Total exit cost estimate (USDC)'],
    ['minimumNetScenarioUsdc', 'Required margin after entered costs (USDC)'],
  ] },
]);
const names = idleCapitalFields.flatMap(group => group.fields.map(([name]) => name));
export function createIdleCapitalState() {
  return { values: Object.fromEntries([...names, 'observedAt'].map(name => [name, ''])), withdrawalTermsReviewed: false, paused: false, example: false, source: null, sourceIssue: false, pendingVault: '', result: null, receipt: null, error: false, saved: { a: null, b: null, receipt: null, error: false } };
}
export function idleCapitalExample(now = Date.now()) {
  return {
    walletUsdc: '10000', reserveUsdc: '2000', committedUsdc: '3000', earmarkedUsdc: '1000', maxAllocationUsdc: '8000',
    vaultAvailableLiquidityUsdc: '50000', maxLiquiditySharePct: '10', scenarioAnnualSimpleRatePct: '5',
    holdingHours: '240', withdrawalLeadHours: '24', entryCostUsdc: '0.5', exitCostUsdc: '0.5', minimumNetScenarioUsdc: '1',
    observedAt: new Date(now).toISOString(),
  };
}
function percentBps(value) {
  if (typeof value !== 'string' || !/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(value)) throw new Error('Enter a percentage from 0 to 100 with at most two decimals.');
  const [whole, part = ''] = value.split('.');
  return Number(whole) * 100 + Number(part.padEnd(2, '0'));
}
function integerHours(value) {
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value) || Number(value) > 8760) throw new Error('Enter whole hours up to 8760.');
  return Number(value);
}
export function idleCapitalInput(values, { withdrawalTermsReviewed = false, paused = false } = {}) {
  const input = Object.fromEntries(names.filter(name => !name.endsWith('Pct') && !name.endsWith('Hours')).map(name => [name, values[name]]));
  return { ...input, observedAt: values.observedAt,
    holdingHours: integerHours(values.holdingHours), withdrawalLeadHours: integerHours(values.withdrawalLeadHours),
    maxLiquidityShareBps: percentBps(values.maxLiquiditySharePct),
    scenarioAnnualSimpleRateBps: percentBps(values.scenarioAnnualSimpleRatePct),
    withdrawalTermsReviewed: withdrawalTermsReviewed === true, paused: paused === true,
  };
}
const reasons = Object.freeze({
  STALE_OR_INVALID_OBSERVATION: 'The figures need a valid timestamp no more than five minutes old.',
  WITHDRAWAL_TERMS_UNREVIEWED: 'Review the withdrawal terms before comparing scenarios.',
  POLICY_PAUSED: 'Scenario review is paused.',
  COMMITMENTS_EXCEED_WALLET: 'Protected cash exceeds the entered wallet balance.',
  INSUFFICIENT_WITHDRAWAL_WINDOW: 'Allow positive withdrawal time before funds are needed.',
  NO_DEPLOYABLE_CAPITAL: 'No capital remains within the entered cash and liquidity limits.',
  SCENARIO_DOES_NOT_CLEAR_COSTS_AND_MARGIN: 'The scenario does not clear entered costs and the required margin.',
  INVALID_INPUT: 'Check all amounts, times and rate assumptions.',
  EARN_SOURCE_UNAVAILABLE: 'The Earn source is unavailable or no longer valid for this scenario.',
  EARN_SOURCE_STALE: 'The Earn source is older than five minutes or has an invalid timestamp.',
  EARN_SOURCE_CHANGED: 'The Earn report changed. Refresh and import the source again.',
  EARN_LIQUIDITY_OVERRIDE: 'The liquidity amount no longer matches the selected Earn report.',
});
export function idleCapitalResultHtml(state) {
  if (!state.result) return '';
  const p = state.result;
  const rows = [
    ['Protected cash', p.protectedUsdc], ['Cash after commitments', p.availableUsdc],
    ['Modeled allocation before checks', p.modeledAllocationUsdc], ['Amount available for manual review', p.reviewableAllocationUsdc],
    ['Gross rate scenario', p.grossScenarioUsdc], ['Net scenario after entered costs', p.netScenarioAfterEnteredCostsUsdc],
  ];
  return '<div class="idle-capital-result"><h4>' + h(p.decision === 'REVIEW_REQUIRED' ? 'Scenario clears entered limits; review required' : 'Keep funds liquid') + '</h4>' +
    (state.example ? '<p>' + (state.source ? 'Cash assumptions began as a synthetic example.' : 'Synthetic example figures; not live market data.') + '</p>' : '') +
    '<dl>' + rows.map(([label, value]) => '<div><dt>' + h(label) + '</dt><dd data-no-translate>' + h(value === null ? '—' : value + ' USDC') + '</dd></div>').join('') +
    '<div><dt>Modeled earning hours</dt><dd data-no-translate>' + h(p.earningHours === null ? '—' : String(p.earningHours)) + '</dd></div></dl>' +
    (p.reasons.length ? '<ul>' + p.reasons.map(reason => '<li>' + h(reasons[reason] || reasons.INVALID_INPUT) + '</li>').join('') + '</ul>' : '') +
    '<p>Scenario result only; this is not permission to invest.</p><button class="idle-capital-download" type="button">DOWNLOAD USDC SCENARIO</button><button class="idle-capital-save-a" type="button">SAVE AS SCENARIO A</button><button class="idle-capital-save-b" type="button">SAVE AS SCENARIO B</button></div>';
}
export function reconcileIdleCapitalSource(state, earnData, now = Date.now()) {
  state.sourceIssue = Boolean(state.source && earnSourceIssues(state.source, earnData, { now }).length);
  if (state.sourceIssue) { state.result = null; state.receipt = null; }
}
function sourceDetailsHtml(state) {
  if (!state.source) return '<p>Exit liquidity is currently a manual assumption.</p>';
  const s = state.source;
  return '<dl class="idle-capital-source-details"><div><dt>Selected Earn vault</dt><dd data-no-translate>' + h(s.name) + ' · ' + h(s.protocol) + '</dd></div>' +
    '<div><dt>Vault address</dt><dd data-no-translate>' + h(s.vaultAddress) + '</dd></div>' +
    '<div><dt>Reported exit liquidity (USDC)</dt><dd data-no-translate>' + h(s.amountUsdc) + ' USDC</dd></div>' +
    '<div><dt>Earn response timestamp (UTC)</dt><dd data-no-translate>' + h(s.retrievedAt) + '</dd></div>' +
    '<div><dt>Provider liquidity timestamp (UTC)</dt><dd data-no-translate>' + h(s.liquidityAsOf ?? '—') + '</dd></div>' +
    '<div><dt>Reported APY, not used in calculation</dt><dd data-no-translate>' + (s.reportedApyPct === null ? '—' : h(s.reportedApyPct) + '%') + '</dd></div></dl>' +
    '<p>A recent API response does not prove fresh underlying vault data or guarantee a withdrawal.</p>' +
    (state.sourceIssue ? '<p role="status">Refresh and import the Earn source again before recalculating.</p>' : '') +
    '<button type="button" class="idle-capital-manual">USE MANUAL LIQUIDITY</button>';
}
export function idleCapitalHtml(state, earnData = null) {
  const sources = earnLiquiditySources(earnData);
  const field = ([name, label, kind]) => '<label><span>' + h(name === 'vaultAvailableLiquidityUsdc' && state.source ? 'Reported exit liquidity (USDC)' : label) + '</span><input required name="' + name +
    '" type="text" inputmode="' + (kind === 'hours' ? 'numeric' : 'decimal') + '" maxlength="25" pattern="' +
    (kind === 'hours' ? '[0-9]{1,4}' : kind === 'percent' ? '[0-9]{1,3}(\\.[0-9]{1,2})?' : '[0-9]{1,18}(\\.[0-9]{1,6})?') +
    '" value="' + h(state.values[name] ?? '') + '"></label>';
  return '<section class="gateway-panel idle-capital-panel" aria-labelledby="idle-capital-title">' +
    '<h3 id="idle-capital-title">USDC planning between commitments</h3>' +
    '<p>Protect reserves and pending payments before comparing one vault scenario.</p>' +
    '<p class="idle-capital-input-origin">' + (state.source ? 'Cash, costs, timing and simple rate remain your estimates; the selected liquidity is a provider report.' : 'Inputs are your estimates; balances, exit liquidity and withdrawal timing are not verified.') + '</p>' +
    '<p>Use a dot for decimals, without thousands separators.</p>' +
    '<div class="idle-capital-source-controls"><label><span>Choose a USDC vault</span><select class="idle-capital-vault" aria-label="Choose a USDC vault"><option value="">Choose a USDC vault</option>' + sources.map(source => '<option data-no-translate value="' + h(source.vaultAddress) + '"' + ((state.pendingVault || state.source?.vaultAddress) === source.vaultAddress ? ' selected' : '') + '>' + h(source.name) + '</option>').join('') + '</select></label><button type="button" class="idle-capital-import"' + (sources.length ? '' : ' disabled') + '>USE REPORTED LIQUIDITY</button><button type="button" class="idle-capital-refresh-earn">REFRESH EARN SOURCES</button></div>' +
    (sources.length ? '' : '<p>No recent active USDC source is available. Refresh Earn or use manual estimates.</p>') +
    '<div class="idle-capital-source-card">' + sourceDetailsHtml(state) + '</div>' +
    '<div class="idle-capital-actions"><button type="button" class="idle-capital-example">LOAD SYNTHETIC EXAMPLE</button><button type="button" class="idle-capital-clear">CLEAR FIGURES</button></div>' +
    '<form class="idle-capital-form">' + idleCapitalFields.map(group => '<fieldset><legend>' + h(group.title) + '</legend><div class="idle-capital-grid">' + group.fields.map(field).join('') + '</div></fieldset>').join('') +
    '<label class="idle-capital-time"><span>Figures recorded at (UTC)</span><input required type="text" name="observedAt" maxlength="30" placeholder="2026-11-22T12:00:00.000Z" value="' + h(state.values.observedAt ?? '') + '"></label>' +
    '<button type="button" class="idle-capital-record-time">RECORD CURRENT TIME</button><p>Timestamp records your estimates, not a live data check.</p>' +
    '<label class="idle-capital-check"><input type="checkbox" name="withdrawalTermsReviewed"' + (state.withdrawalTermsReviewed ? ' checked' : '') + '><span>I reviewed the withdrawal terms used in this scenario.</span></label>' +
    '<label class="idle-capital-check"><input type="checkbox" name="paused"' + (state.paused ? ' checked' : '') + '><span>Pause scenario review</span></label>' +
    '<button type="submit">EVALUATE USDC SCENARIO</button></form>' +
    '<p class="idle-capital-status" role="status">' + (state.error ? 'Check all amounts, times and rate assumptions.' : '') + '</p>' +
    '<div class="idle-capital-output" aria-live="polite">' + idleCapitalResultHtml(state) + '</div>' +
    '<div class="idle-capital-comparison-output">' + idleCapitalComparisonHtml(state.saved) + '</div>' +
    '<p>Use a simple annual rate assumption, not a promised APY. Include gas, execution fees and failed attempts in cost estimates.</p>' +
    '<p>No deposit, approval or signature. Capital losses and changing rates are not modeled.</p></section>';
}

export function mountIdleCapital(root, state, { now = Date.now, download = () => {}, getEarnData = () => null, refreshEarn = () => {} } = {}) {
  const panel = root.querySelector('.idle-capital-panel');
  if (!panel) return;
  const form = panel.querySelector('.idle-capital-form');
  const output = panel.querySelector('.idle-capital-output');
  const status = panel.querySelector('.idle-capital-status');
  const sourceSelect = panel.querySelector('.idle-capital-vault');
  function renderComparison() { panel.querySelector('.idle-capital-comparison-output').innerHTML = idleCapitalComparisonHtml(state.saved); }
  function renderSource() {
    panel.querySelector('.idle-capital-source-card').innerHTML = sourceDetailsHtml(state);
    const liquidityInput = form.elements.namedItem('vaultAvailableLiquidityUsdc');
    liquidityInput.readOnly = Boolean(state.source);
    liquidityInput.closest('label').querySelector('span').textContent = state.source ? 'Reported exit liquidity (USDC)' : 'Assumed available exit liquidity (USDC)';
    panel.querySelector('.idle-capital-input-origin').textContent = state.source ? 'Cash, costs, timing and simple rate remain your estimates; the selected liquidity is a provider report.' : 'Inputs are your estimates; balances, exit liquidity and withdrawal timing are not verified.';
  }
  renderSource();
  function read() {
    for (const name of [...names, 'observedAt']) state.values[name] = form.elements.namedItem(name).value.trim();
    state.withdrawalTermsReviewed = form.elements.namedItem('withdrawalTermsReviewed').checked;
    state.paused = form.elements.namedItem('paused').checked;
  }
  function invalidate(message = 'Figures changed. Recalculate before downloading.') {
    state.result = null; state.receipt = null; state.error = false;
    output.replaceChildren(); status.textContent = message;
  }
  form.addEventListener('input', () => { read(); invalidate(); });
  form.addEventListener('change', () => { read(); invalidate(); });
  sourceSelect.addEventListener('change', () => {
    state.pendingVault = sourceSelect.value;
    if (!state.pendingVault) { state.source = null; state.sourceIssue = false; renderSource(); }
    invalidate('Import the selected liquidity or switch to manual estimates.');
  });
  panel.querySelector('.idle-capital-refresh-earn').addEventListener('click', () => refreshEarn());
  panel.querySelector('.idle-capital-import').addEventListener('click', () => {
    const source = earnLiquiditySource(getEarnData(), sourceSelect.value, { now: now() });
    if (!source) { invalidate('Refresh and import the Earn source again before recalculating.'); return; }
    state.source = source; state.sourceIssue = false; state.pendingVault = '';
    state.values.vaultAvailableLiquidityUsdc = source.amountUsdc;
    form.elements.namedItem('vaultAvailableLiquidityUsdc').value = source.amountUsdc;
    state.withdrawalTermsReviewed = false; form.elements.namedItem('withdrawalTermsReviewed').checked = false;
    invalidate('Reported liquidity imported. Review cash assumptions, costs and withdrawal terms.'); renderSource();
  });
  panel.querySelector('.idle-capital-record-time').addEventListener('click', () => {
    state.values.observedAt = new Date(now()).toISOString();
    form.elements.namedItem('observedAt').value = state.values.observedAt;
    invalidate();
  });
  panel.querySelector('.idle-capital-example').addEventListener('click', () => {
    state.source = null; state.sourceIssue = false; state.pendingVault = ''; sourceSelect.value = '';
    state.values = idleCapitalExample(now()); state.withdrawalTermsReviewed = false; state.paused = false; state.example = true;
    for (const name of [...names, 'observedAt']) form.elements.namedItem(name).value = state.values[name];
    form.elements.namedItem('withdrawalTermsReviewed').checked = false; form.elements.namedItem('paused').checked = false;
    invalidate('Synthetic example loaded. Review all assumptions and withdrawal terms.');
    renderSource();
  });
  panel.querySelector('.idle-capital-clear').addEventListener('click', () => {
    Object.assign(state, createIdleCapitalState());
    for (const name of [...names, 'observedAt']) form.elements.namedItem(name).value = '';
    form.elements.namedItem('withdrawalTermsReviewed').checked = false; form.elements.namedItem('paused').checked = false;
    invalidate('Figures cleared.');
    sourceSelect.value = ''; renderSource();
    renderComparison();
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); read(); invalidate('');
    if (state.pendingVault) { status.textContent = 'Import the selected liquidity or switch to manual estimates.'; return; }
    try {
      const at = now();
      const input = idleCapitalInput(state.values, state);
      state.result = state.source ? planIdleUsdcWithEarn(input, state.source, getEarnData(), { now: at }) : planIdleUsdc(input, { now: at });
      state.receipt = createIdleCapitalReceipt(state.result, { generatedAt: new Date(at).toISOString(), example: state.example });
      output.innerHTML = idleCapitalResultHtml(state);
    } catch {
      state.result = null; state.receipt = null; state.error = true;
      status.textContent = 'Check all amounts, times and rate assumptions.';
    }
  });
  panel.addEventListener('click', event => {
    for (const key of ['a', 'b']) if (event.target.closest('.idle-capital-save-' + key) && state.receipt) {
      try {
        state.saved[key] = captureIdleCapitalScenario(state.receipt);
        state.saved.error = false; state.saved.receipt = null;
        if (state.saved.a && state.saved.b) state.saved.receipt = createIdleCapitalComparisonReceipt(state.saved.a, state.saved.b, { generatedAt: new Date(now()).toISOString() });
      } catch { state.saved.error = true; state.saved.receipt = null; }
      renderComparison();
    }
    if (event.target.closest('.idle-comparison-clear')) { state.saved = { a: null, b: null, receipt: null, error: false }; renderComparison(); }
    if (event.target.closest('.idle-comparison-download') && state.saved.receipt) download(state.saved.receipt);
    if (event.target.closest('.idle-capital-manual')) {
      state.source = null; state.sourceIssue = false; state.pendingVault = ''; sourceSelect.value = '';
      invalidate('Exit liquidity is currently a manual assumption.'); renderSource();
    }
    if (event.target.closest('.idle-capital-download') && state.receipt) download(state.receipt);
  });
}

