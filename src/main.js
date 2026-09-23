import "./styles.css";
import { markets } from "./markets.js";
import { evaluateMarket, policy } from "./policy.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const app = document.querySelector("#app");
let selectedId = markets[0].id;

function logo() {
  return `<div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>`;
}

function valueFor(ruleItem) {
  if (ruleItem.id === "liquidity") return money.format(ruleItem.value);
  if (["utilization", "volatility", "completeness"].includes(ruleItem.id)) return `${ruleItem.value}%`;
  if (ruleItem.id === "freshness") return `${ruleItem.value} min`;
  return String(ruleItem.value);
}

function render() {
  const market = markets.find((item) => item.id === selectedId);
  const report = evaluateMarket(market);
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#">${logo()}<strong><i>Coffer</i>House</strong><span>SCOUT</span></a>
      <div class="network"><span></span> ARC · READ ONLY</div>
    </header>
    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">RISK INTELLIGENCE FOR PROGRAMMABLE MARKETS</p>
          <h1>See the risk<br><em>before</em> the move.</h1>
          <p class="intro">Scout compares tokenized assets and crypto markets on Arc using visible, deterministic rules. No black box. No custody. No execution.</p>
        </div>
        <aside class="hero-note"><b>DEMO MODE</b><p>Market observations below are illustrative until the first live Arc adapter is connected.</p></aside>
      </section>

      <section class="workspace">
        <nav class="market-list" aria-label="Markets">
          <div class="section-label">SELECT A MARKET</div>
          ${markets.map((item) => `<button class="market-button ${item.id === selectedId ? "active" : ""}" data-id="${item.id}">
            <span class="asset-icon">${item.symbol.slice(0, 2)}</span>
            <span><b>${item.name}</b><small>${item.category}</small></span>
            <span class="chevron">→</span>
          </button>`).join("")}
          <div class="policy-card"><span>POLICY</span><b>${policy.version}</b><small>8 deterministic checks</small></div>
        </nav>

        <article class="report">
          <div class="report-head">
            <div><span class="category">${market.category}</span><h2>${market.name}</h2><p>${market.protocol} · ${market.network}</p></div>
            <div class="verdict ${report.status.toLowerCase()}"><span>${report.status}</span><b>${report.score}</b><small>/ 100</small></div>
          </div>

          <div class="summary ${report.status.toLowerCase()}"><b>${report.summary}</b><span>${market.note}</span></div>

          <div class="metrics">
            <div><span>LIQUIDITY</span><b>${money.format(market.liquidityUsd)}</b></div>
            <div><span>UTILIZATION</span><b>${market.utilizationPct}%</b></div>
            <div><span>DISPLAYED APY</span><b>${market.apyPct}%</b></div>
            <div><span>DATA AGE</span><b>${market.ageMinutes} min</b></div>
          </div>

          <div class="checks-head"><h3>Policy checks</h3><span>Same inputs → same result</span></div>
          <div class="checks">
            ${report.rules.map((item) => `<div class="check">
              <span class="signal ${item.outcome}">${item.outcome === "pass" ? "✓" : item.outcome === "review" ? "!" : "×"}</span>
              <div><b>${item.label}</b><small>${item.detail}</small></div>
              <strong>${valueFor(item)}</strong>
            </div>`).join("")}
          </div>

          <footer class="source-row">
            <div><span>SOURCE</span><b>${market.source}</b></div>
            <div><span>OBSERVED</span><b>${market.observedAt}</b></div>
            <a href="${market.sourceUrl}" target="_blank" rel="noreferrer">Open Arc explorer ↗</a>
          </footer>
        </article>
      </section>
    </main>
    <footer class="site-footer"><span>Research first. Execution later.</span><span>Experimental software · Not financial advice</span></footer>`;

  document.querySelectorAll(".market-button").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    render();
  }));
}

render();
