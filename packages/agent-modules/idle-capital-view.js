import { escapeHtml as h } from '../shared/index.js';
import { planIdleUsdc } from './idle-capital.js';
import { createIdleCapitalReceipt } from '../evidence/idle-capital-receipt.js';

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
  return { values: Object.fromEntries([...names, 'observedAt'].map(name => [name, ''])), withdrawalTermsReviewed: false, paused: false, example: false, result: null, receipt: null, error: false };
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
    (state.example ? '<p>Synthetic example figures; not live market data.</p>' : '') +
    '<dl>' + rows.map(([label, value]) => '<div><dt>' + h(label) + '</dt><dd data-no-translate>' + h(value === null ? '—' : value + ' USDC') + '</dd></div>').join('') +
    '<div><dt>Modeled earning hours</dt><dd data-no-translate>' + h(p.earningHours === null ? '—' : String(p.earningHours)) + '</dd></div></dl>' +
    (p.reasons.length ? '<ul>' + p.reasons.map(reason => '<li>' + h(reasons[reason] || reasons.INVALID_INPUT) + '</li>').join('') + '</ul>' : '') +
    '<p>Scenario result only; this is not permission to invest.</p><button class="idle-capital-download" type="button">DOWNLOAD USDC SCENARIO</button></div>';
}
export function idleCapitalHtml(state) {
  const field = ([name, label, kind]) => '<label><span>' + h(label) + '</span><input required name="' + name +
    '" type="text" inputmode="' + (kind === 'hours' ? 'numeric' : 'decimal') + '" maxlength="25" pattern="' +
    (kind === 'hours' ? '[0-9]{1,4}' : kind === 'percent' ? '[0-9]{1,3}(\\.[0-9]{1,2})?' : '[0-9]{1,18}(\\.[0-9]{1,6})?') +
    '" value="' + h(state.values[name] ?? '') + '"></label>';
  return '<section class="gateway-panel idle-capital-panel" aria-labelledby="idle-capital-title">' +
    '<h3 id="idle-capital-title">USDC planning between commitments</h3>' +
    '<p>Protect reserves and pending payments before comparing one vault scenario.</p>' +
    '<p>Inputs are your estimates; balances, exit liquidity and withdrawal timing are not verified.</p>' +
    '<p>Use a dot for decimals, without thousands separators.</p>' +
    '<div class="idle-capital-actions"><button type="button" class="idle-capital-example">LOAD SYNTHETIC EXAMPLE</button><button type="button" class="idle-capital-clear">CLEAR FIGURES</button></div>' +
    '<form class="idle-capital-form">' + idleCapitalFields.map(group => '<fieldset><legend>' + h(group.title) + '</legend><div class="idle-capital-grid">' + group.fields.map(field).join('') + '</div></fieldset>').join('') +
    '<label class="idle-capital-time"><span>Figures recorded at (UTC)</span><input required type="text" name="observedAt" maxlength="30" placeholder="2026-11-22T12:00:00.000Z" value="' + h(state.values.observedAt ?? '') + '"></label>' +
    '<button type="button" class="idle-capital-record-time">RECORD CURRENT TIME</button><p>Timestamp records your estimates, not a live data check.</p>' +
    '<label class="idle-capital-check"><input type="checkbox" name="withdrawalTermsReviewed"' + (state.withdrawalTermsReviewed ? ' checked' : '') + '><span>I reviewed the withdrawal terms used in this scenario.</span></label>' +
    '<label class="idle-capital-check"><input type="checkbox" name="paused"' + (state.paused ? ' checked' : '') + '><span>Pause scenario review</span></label>' +
    '<button type="submit">EVALUATE USDC SCENARIO</button></form>' +
    '<p class="idle-capital-status" role="status">' + (state.error ? 'Check all amounts, times and rate assumptions.' : '') + '</p>' +
    '<div class="idle-capital-output" aria-live="polite">' + idleCapitalResultHtml(state) + '</div>' +
    '<p>Use a simple annual rate assumption, not a promised APY. Include gas, execution fees and failed attempts in cost estimates.</p>' +
    '<p>No deposit, approval or signature. Capital losses and changing rates are not modeled.</p></section>';
}

export function mountIdleCapital(root, state, { now = Date.now, download = () => {} } = {}) {
  const panel = root.querySelector('.idle-capital-panel');
  if (!panel) return;
  const form = panel.querySelector('.idle-capital-form');
  const output = panel.querySelector('.idle-capital-output');
  const status = panel.querySelector('.idle-capital-status');
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
  panel.querySelector('.idle-capital-record-time').addEventListener('click', () => {
    state.values.observedAt = new Date(now()).toISOString();
    form.elements.namedItem('observedAt').value = state.values.observedAt;
    invalidate();
  });
  panel.querySelector('.idle-capital-example').addEventListener('click', () => {
    state.values = idleCapitalExample(now()); state.withdrawalTermsReviewed = false; state.paused = false; state.example = true;
    for (const name of [...names, 'observedAt']) form.elements.namedItem(name).value = state.values[name];
    form.elements.namedItem('withdrawalTermsReviewed').checked = false; form.elements.namedItem('paused').checked = false;
    invalidate('Synthetic example loaded. Review all assumptions and withdrawal terms.');
  });
  panel.querySelector('.idle-capital-clear').addEventListener('click', () => {
    Object.assign(state, createIdleCapitalState());
    for (const name of [...names, 'observedAt']) form.elements.namedItem(name).value = '';
    form.elements.namedItem('withdrawalTermsReviewed').checked = false; form.elements.namedItem('paused').checked = false;
    invalidate('Figures cleared.');
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); read(); invalidate('');
    try {
      const at = now();
      state.result = planIdleUsdc(idleCapitalInput(state.values, state), { now: at });
      state.receipt = createIdleCapitalReceipt(state.result, { generatedAt: new Date(at).toISOString(), example: state.example });
      output.innerHTML = idleCapitalResultHtml(state);
    } catch {
      state.result = null; state.receipt = null; state.error = true;
      status.textContent = 'Check all amounts, times and rate assumptions.';
    }
  });
  panel.addEventListener('click', event => {
    if (event.target.closest('.idle-capital-download') && state.receipt) download(state.receipt);
  });
}
