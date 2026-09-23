import "./styles.css";
import { demoMarkets } from "./markets.js";
import { fetchMorphoArcMarkets } from "./morpho.js";
import { evaluateMarket, policy } from "./policy.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const formatMoney = (value) => value === null || value === undefined ? "Unavailable" : money.format(value);
const formatPct = (value, digits = 1) => value === null || value === undefined ? "Unavailable" : `${value.toFixed(digits)}%`;
const app = document.querySelector("#app");
let markets = demoMarkets;
let selectedId = markets[0].id;
let feedState = { mode: "loading", message: "Connecting to Morpho on Arc…" };

function valueFor(ruleItem) {
  if (ruleItem.value === null || ruleItem.value === undefined) return "Unavailable";
  if (ruleItem.id === "liquidity") return formatMoney(ruleItem.value);
  if (["utilization", "volatility", "completeness"].includes(ruleItem.id)) return formatPct(Number(ruleItem.value));
  if (ruleItem.id === "freshness") return `${ruleItem.value} min`;
  return String(ruleItem.value);
}

function render() {
  const market = markets.find((item) => item.id === selectedId);
  const report = evaluateMarket(market);
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="CofferHouse Scout">
        <img class="brand-arch" src="/brand/cofferhouse-arch-official.png" alt="">
        <strong class="brand-name" aria-hidden="true"><i>C</i><i>O</i><i>F</i><i>F</i><i>E</i><i>R</i><i>H</i><i>O</i><i>U</i><i>S</i><i>E</i></strong>
        <span>SCOUT</span>
      </a>
      <div class="network"><span></span> ARC MAINNET · READ ONLY</div>
    </header>
    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">RISK INTELLIGENCE FOR PROGRAMMABLE MARKETS</p>
          <h1>See the risk<br><em>before</em> the move.</h1>
          <p class="intro">Scout compares tokenized assets and crypto markets on Arc using visible, deterministic rules. No black box. No custody. No execution.</p>
        </div>
        <aside class="hero-note ${feedState.mode}"><b>${feedState.mode === "live" ? "LIVE ARC DATA" : feedState.mode === "loading" ? "CONNECTING" : "SAFE FALLBACK"}</b><p>${feedState.message}</p></aside>
      </section>

      <section class="workspace">
        <nav class="market-list" aria-label="Markets">
          <div class="section-label">SELECT A MARKET</div>
          ${markets.map((item) => `<button class="market-button ${item.id === selectedId ? "active" : ""}" data-id="${item.id}">
            <span class="asset-icon">${item.symbol.slice(0, 2)}</span>
            <span><b>${item.name}</b><small>${item.protocol} · ${item.category}</small></span>
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
            <div><span>LIQUIDITY</span><b>${formatMoney(market.liquidityUsd)}</b></div>
            <div><span>UTILIZATION</span><b>${formatPct(market.utilizationPct)}</b></div>
            <div><span>SUPPLY APY</span><b>${formatPct(market.apyPct, 3)}</b></div>
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

fetchMorphoArcMarkets()
  .then((liveMarkets) => {
    markets = liveMarkets;
    selectedId = liveMarkets[0].id;
    feedState = { mode: "live", message: `${liveMarkets.length} listed Morpho markets loaded from Arc mainnet.` };
    render();
  })
  .catch((error) => {
    console.warn("Scout live adapter unavailable:", error);
    feedState = { mode: "fallback", message: "Live data is unavailable. Showing clearly labeled demonstration observations." };
    render();
  });
