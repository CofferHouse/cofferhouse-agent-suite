import "./styles.css";
import { demoMarkets } from "./markets.js";
import { fetchMorphoArcMarkets } from "./morpho.js";
import { evaluateMarket, policyProfiles } from "./policy.js";
import { scanMarkets } from "./agent.js";
import { createScoutReceipt, createSimulationReceipt, downloadScoutReceipt } from "./receipt.js";
import { simulateBorrow } from "./simulator.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const formatMoney = (value) => value === null || value === undefined ? "Unavailable" : money.format(value);
const formatPct = (value, digits = 1) => value === null || value === undefined ? "Unavailable" : `${value.toFixed(digits)}%`;
const shortId = (value) => value && value.startsWith("0x") && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value || "Unavailable";
const explorerAddress = (address) => address ? `https://arc.etherscan.io/address/${address}` : null;
const identityValue = (label, value, url = null) => `<div><span>${label}</span>${url ? `<a href="${url}" target="_blank" rel="noreferrer" title="${value}">${shortId(value)} ↗</a>` : `<b title="${value || ""}">${shortId(value)}</b>`}</div>`;
const app = document.querySelector("#app");
let markets = demoMarkets;
let selectedId = markets[0].id;
let selectedPolicyId = "balanced";
let feedState = { mode: "loading", message: "Connecting to Morpho on Arc…" };
let activePolicy = policyProfiles[selectedPolicyId];
let agentScan = scanMarkets(markets, (market) => evaluateMarket(market, activePolicy));
let agentState = "idle";
let simulationAmount = 100_000;

function valueFor(ruleItem) {
  if (ruleItem.value === null || ruleItem.value === undefined) return "Unavailable";
  if (ruleItem.id === "liquidity") return formatMoney(ruleItem.value);
  if (["utilization", "volatility", "completeness"].includes(ruleItem.id)) return formatPct(Number(ruleItem.value));
  if (ruleItem.id === "freshness") return `${ruleItem.value} min`;
  return String(ruleItem.value);
}

function render() {
  const market = markets.find((item) => item.id === selectedId);
  activePolicy = policyProfiles[selectedPolicyId];
  const report = evaluateMarket(market, activePolicy);
  const profileComparison = Object.values(policyProfiles).map((profile) => ({ profile, report: evaluateMarket(market, profile) }));
  const simulation = simulateBorrow(market, simulationAmount, activePolicy);
  const simulationReceipt = simulation.ok ? createSimulationReceipt(market, simulation, activePolicy) : null;
  const receipt = createScoutReceipt(agentScan, activePolicy);
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

      <section class="agent-panel" aria-labelledby="agent-title">
        <div class="agent-head">
          <div><p class="eyebrow">BOUNDED AGENT · NO EXECUTION</p><h2 id="agent-title">Scout every market.</h2><p>The agent applies the same public policy to every observation, ranks the results and exposes the first reason that needs attention.</p></div>
          <div class="agent-actions">
            <button class="receipt-button" type="button">DOWNLOAD RECEIPT</button>
            <button class="scan-button" type="button" ${agentState === "scanning" ? "disabled" : ""}>${agentState === "scanning" ? "SCANNING…" : "RUN NEW SCAN"}</button>
          </div>
        </div>
        <div class="policy-selector">
          <label for="policy-profile"><span>ACTIVE POLICY PROFILE</span><b>${activePolicy.name}</b><small>${activePolicy.description}</small></label>
          <select id="policy-profile" aria-label="Risk policy profile">
            ${Object.values(policyProfiles).map((profile) => `<option value="${profile.id}" ${profile.id === selectedPolicyId ? "selected" : ""}>${profile.name}</option>`).join("")}
          </select>
          <code>${activePolicy.version}</code>
        </div>
        <div class="agent-stats">
          <div><span>MARKETS</span><b>${agentScan.total}</b></div>
          <div class="pass"><span>PASS</span><b>${agentScan.counts.PASS}</b></div>
          <div class="review"><span>REVIEW</span><b>${agentScan.counts.REVIEW}</b></div>
          <div class="reject"><span>REJECT</span><b>${agentScan.counts.REJECT}</b></div>
        </div>
        <div class="agent-ranking">
          ${agentScan.ranked.map((item, index) => `<button class="agent-market" data-id="${item.market.id}" type="button">
            <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
            <span><b>${item.market.name}</b><small class="market-id">ID ${shortId(item.market.marketId)}</small><small>${item.reason}</small></span>
            <strong class="rank-status ${item.report.status.toLowerCase()}">${item.report.status} · ${item.report.score}</strong>
          </button>`).join("")}
        </div>
        <footer><span>RECEIPT ${receipt.receiptId} · ${activePolicy.version}</span><span>${agentScan.actionable} market${agentScan.actionable === 1 ? "" : "s"} currently clear every active check</span></footer>
      </section>

      <section class="workspace">
        <nav class="market-list" aria-label="Markets">
          <div class="section-label">SELECT A MARKET</div>
          ${markets.map((item) => `<button class="market-button ${item.id === selectedId ? "active" : ""}" data-id="${item.id}">
            <span class="asset-icon">${item.symbol.slice(0, 2)}</span>
            <span><b>${item.name}</b><small>${item.protocol} · ${item.category}</small><small class="market-id">ID ${shortId(item.marketId)}</small></span>
            <span class="chevron">→</span>
          </button>`).join("")}
          <div class="policy-card"><span>POLICY</span><b>${activePolicy.version}</b><small>8 deterministic checks</small></div>
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

          <div class="identity" aria-label="Market identity">
            ${identityValue("MARKET ID", market.marketId)}
            ${identityValue("LOAN ASSET", market.loanAssetAddress, explorerAddress(market.loanAssetAddress))}
            ${identityValue("COLLATERAL", market.collateralAssetAddress, explorerAddress(market.collateralAssetAddress))}
            ${identityValue("ORACLE", market.oracleAddress, explorerAddress(market.oracleAddress))}
            ${identityValue("LLTV", formatPct(market.lltvPct, 1))}
            ${identityValue("BORROW APY", formatPct(market.borrowApyPct, 3))}
          </div>

          <section class="profile-comparison" aria-labelledby="comparison-title">
            <div class="comparison-head"><h3 id="comparison-title">Policy comparison</h3><span>Same market · three visible bounds</span></div>
            <div class="comparison-grid">
              ${profileComparison.map(({ profile, report: profileReport }) => `<div class="comparison-card ${profile.id === selectedPolicyId ? "active" : ""}">
                <span>${profile.name}</span>
                <b class="${profileReport.status.toLowerCase()}">${profileReport.status} · ${profileReport.score}</b>
                <small>${profileReport.warnings[0]?.detail ?? "Every active check passed."}</small>
              </div>`).join("")}
            </div>
          </section>

          <section class="simulator" aria-labelledby="simulator-title">
            <div class="simulator-copy">
              <span>READ-ONLY ACTION SIMULATION</span>
              <h3 id="simulator-title">Preview a hypothetical borrow.</h3>
              <p>Estimate the immediate liquidity and utilization impact before any wallet or transaction exists.</p>
            </div>
            <form class="simulation-form">
              <label for="borrow-amount">USD EQUIVALENT</label>
              <div><input id="borrow-amount" name="amount" type="number" min="1" step="1000" value="${simulationAmount}"><button type="submit">SIMULATE</button></div>
            </form>
            ${simulation.ok ? `<div class="simulation-results">
              <div><span>AVAILABLE LIQUIDITY</span><b>${formatMoney(simulation.before.liquidityUsd)}</b><i>→</i><strong>${formatMoney(simulation.after.liquidityUsd)}</strong></div>
              <div><span>UTILIZATION</span><b>${formatPct(simulation.before.utilizationPct)}</b><i>→</i><strong>${formatPct(simulation.after.utilizationPct)}</strong></div>
              <div><span>POLICY RESULT</span><b class="${simulation.before.report.status.toLowerCase()}">${simulation.before.report.status}</b><i>→</i><strong class="${simulation.after.report.status.toLowerCase()}">${simulation.after.report.status} · ${simulation.after.report.score}</strong></div>
            </div>` : `<p class="simulation-error">${simulation.error}</p>`}
            <div class="simulation-foot"><small class="simulation-notice">Simulation only · No custody · No signature · No transaction</small>${simulationReceipt ? `<button class="simulation-download" type="button">DOWNLOAD SIMULATION</button>` : ""}</div>
          </section>

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
  document.querySelectorAll(".agent-market").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    render();
    document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.querySelector(".scan-button")?.addEventListener("click", () => refreshMarkets());
  document.querySelector(".receipt-button")?.addEventListener("click", () => downloadScoutReceipt(receipt));
  document.querySelector("#policy-profile")?.addEventListener("change", (event) => {
    selectedPolicyId = event.target.value;
    activePolicy = policyProfiles[selectedPolicyId];
    agentScan = scanMarkets(markets, (item) => evaluateMarket(item, activePolicy));
    render();
  });
  document.querySelector(".simulation-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    simulationAmount = Number(new FormData(event.currentTarget).get("amount"));
    render();
  });
  document.querySelector(".simulation-download")?.addEventListener("click", () => downloadScoutReceipt(simulationReceipt));
}

async function refreshMarkets() {
  agentState = "scanning";
  feedState = { mode: "loading", message: "Scout Agent is requesting a fresh Arc market snapshot…" };
  render();

  try {
    const liveMarkets = await fetchMorphoArcMarkets();
    markets = liveMarkets;
    if (!markets.some((market) => market.id === selectedId)) selectedId = liveMarkets[0].id;
    agentScan = scanMarkets(liveMarkets, (market) => evaluateMarket(market, activePolicy));
    feedState = { mode: "live", message: `${liveMarkets.length} listed Morpho markets loaded from Arc mainnet.` };
  } catch (error) {
    console.warn("Scout live adapter unavailable:", error);
    markets = demoMarkets;
    selectedId = markets[0].id;
    agentScan = scanMarkets(markets, (market) => evaluateMarket(market, activePolicy));
    feedState = { mode: "fallback", message: "Live data is unavailable. Showing clearly labeled demonstration observations." };
  } finally {
    agentState = "idle";
    render();
  }
}

render();
refreshMarkets();
