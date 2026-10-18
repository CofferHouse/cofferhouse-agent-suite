import {simulateBot, filterScanner} from './bot-lab.js';
const usd = value => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2}).format(value);
let state = {kind:'ddca', scenario:'range', capital:1000, feeBps:20, chain:'all', minLiquidity:0};
export function botLabHtml() {
  return `<div class="bot-lab"><p class="eyebrow">THE BOT WORKSHOP · DEMOS</p><h2>Little bots. Big ideas.</h2><p>Pick a bot, try a scenario and see what changes. Practice with simulated USDC before the real tools arrive.</p><div class="bot-lab-cards"><article class="bot-card-ddca"><span class="bot-sticker">ONE STEP AT A TIME</span><h3>DDCA</h3><p>Six equal purchases. Explore how timing and fees change the position.</p><button type="button" data-bot-pick="ddca">TRY DDCA ↗</button></article><article class="bot-card-grid"><span class="bot-sticker">MIND THE GAPS</span><h3>Grid</h3><p>One spot bracket: buy at 95, sell at 105. Falling prices can leave a losing position.</p><button type="button" data-bot-pick="grid">TRY GRID ↗</button></article><article class="bot-card-scanner"><span class="bot-sticker">LOOK AROUND</span><h3>Scanner</h3><p>Filter fictional opportunities across chains. Results are examples, not live recommendations.</p><button type="button" data-bot-pick="scanner">TRY SCANNER ↗</button></article></div><div class="bot-workbench-title"><span>02 / THE WORKBENCH</span><b>Try it on paper.</b><small>DEMO ONLY · NO WALLET</small></div><form id="bot-lab-form"><label>Demo<select name="kind"><option value="ddca">DDCA</option><option value="grid">Grid</option><option value="scanner">Scanner</option></select></label><label data-bot-fields="trading">Price path<select name="scenario"><option value="range">Range</option><option value="rising">Rising</option><option value="falling">Falling</option></select></label><label data-bot-fields="trading">Capital (simulated USDC)<input name="capital" type="number" min="10" max="100000" value="1000" required></label><label data-bot-fields="trading">Fee per trade (bps)<input name="feeBps" type="number" min="0" max="100" value="20" required></label><label data-bot-fields="scanner">Example chain<select name="chain"><option value="all">All</option><option>Arc</option><option>Ethereum</option><option>Base</option></select></label><label data-bot-fields="scanner">Minimum example liquidity<input name="minLiquidity" type="number" min="0" max="10000000" value="0" required></label><button type="submit">RUN SIMULATION</button></form><div id="bot-lab-results" aria-live="polite"></div><p class="bot-lab-note">Educational model · Synthetic prices · No APY forecast · Spot only · Fees included; gas, slippage, latency and partial fills excluded. Future Scout/Guardian connections are planned, not enabled.</p></div>`;
}
export function mountBotLab() {
  const form=document.querySelector('#bot-lab-form');
  if (!form) return;
  for (const [key,value] of Object.entries(state)) form.elements.namedItem(key).value=value;
  const draw=()=>{
    document.querySelectorAll('[data-bot-fields]').forEach(label => { const hide = (state.kind === 'scanner') !== (label.dataset.botFields === 'scanner'); label.hidden = hide; label.querySelectorAll('input,select').forEach(field => field.disabled = hide); });
    document.querySelectorAll('[data-bot-pick]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.botPick === state.kind)); });
    const results=document.querySelector('#bot-lab-results');
    try {
      if(state.kind==='scanner') {
        const rows=filterScanner(state.chain,state.minLiquidity);
        results.innerHTML=`<h3>FICTIONAL SCANNER RESULTS</h3><p>No bridge, pool or exchange is connected.</p><ul>${rows.map(row=>`<li>${row.chain} · ${row.name} · ${usd(row.liquidity)} example liquidity · ${row.risk}</li>`).join('') || '<li>No examples match these filters.</li>'}</ul>`;
      } else {
        const result=simulateBot(state);
        results.innerHTML=`<h3>SIMULATED RESULT</h3><div class="bot-lab-metrics"><p>Final equity<strong>${usd(result.equity)}</strong></p><p>Unrealized + realized P/L<strong>${usd(result.pnl)}</strong></p><p>Fees paid<strong>${usd(result.fees)}</strong></p><p>Remaining cash<strong>${usd(result.cash)}</strong></p></div><p>Synthetic price path: ${result.prices.join(' → ')}. Open asset units: ${result.units.toFixed(6)}.</p><ol>${result.orders.map(order=>`<li>Step ${order.step+1}: ${order.side} at ${order.price}; fee ${usd(order.fee)}</li>`).join('') || '<li>No level crossed; no orders.</li>'}</ol>`;
      }
    } catch {results.textContent='Enter capital from 10 to 100,000 and fees from 0 to 100 bps.';}
  };
  document.querySelectorAll('[data-bot-pick]').forEach(button => button.addEventListener('click', () => { state.kind=button.dataset.botPick; form.elements.namedItem('kind').value=state.kind; draw(); }));
  form.elements.namedItem('kind').addEventListener('change', () => { state.kind=form.elements.namedItem('kind').value; draw(); });
  form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);state={kind:data.get('kind'),scenario:data.get('scenario')||state.scenario,capital:data.has('capital')?Number(data.get('capital')):state.capital,feeBps:data.has('feeBps')?Number(data.get('feeBps')):state.feeBps,chain:data.get('chain')||state.chain,minLiquidity:data.has('minLiquidity')?Number(data.get('minLiquidity')):state.minLiquidity};draw();});
  draw();
}
