import { escapeHtml as h } from '../shared/index.js';
import { coinbaseProducts } from '../arc-data/coinbase.js';
export function coinbaseHtml(state) {
  const o = state.observation, p = state.preview;
  return `<section class="gateway-panel coinbase-panel" aria-labelledby="coinbase-title">
    <h3 id="coinbase-title">Coinbase · spot research</h3>
    <p>Public market data. No Coinbase account is connected.</p>
    <form class="coinbase-market-form"><label><span>Product</span><select name="product">${coinbaseProducts.map(id => `<option value="${id}" ${id === state.product ? 'selected' : ''}>${id}</option>`).join('')}</select></label><button type="submit" ${state.mode === 'loading' ? 'disabled' : ''}>CHECK COINBASE MARKET</button></form>
    ${state.mode === 'loading' ? '<p role="status">Checking Coinbase…</p>' : ''}
    ${state.mode === 'error' ? '<p role="status">Coinbase evidence is unavailable. Refresh before simulating.</p>' : ''}
    ${o ? `<p><code>${h(o.productId)}</code> · <span>Reference price</span>: <code>${h(o.price)} ${h(o.quote)}</code></p><p><span>Observed at</span>: <time>${h(o.observedAt)}</time></p>
      <form class="coinbase-paper-form"><label><span>Hypothetical amount in quote currency</span><input name="amount" type="number" min="0.01" max="10000" step="0.01" required value="100"></label><button type="submit">CALCULATE PAPER ESTIMATE</button></form>
      ${state.previewError ? '<p role="status">Refresh evidence and enter a valid amount.</p>' : ''}
      ${p ? `<p><span>Approximate base units before costs</span>: <code>${h(String(p.estimatedBase))} ${h(p.base)}</code></p>` : ''}
      <button type="button" class="coinbase-download">DOWNLOAD COINBASE EVIDENCE</button>` : ''}
    <p>Paper estimate only. Fees, spread and slippage are excluded. No order is created.</p>
    <p>Spot research does not establish eligibility for the derivatives competition.</p>
  </section>`;
}
