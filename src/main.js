import "./styles.css";
import { demoMarkets } from "./markets.js";
import { fetchMorphoArcMarkets } from "./morpho.js";
import { evaluateMarket, policyProfiles } from "./policy.js";
import { scanMarkets } from "./agent.js";
import { createScoutReceipt, createSimulationReceipt, downloadScoutReceipt, verifyReceiptDocument } from "./receipt.js";
import { simulateBorrow, suggestedBorrowAmount } from "./simulator.js";
import { compareMarketSnapshots } from "./monitor.js";
import { addMonitorObservation, clearMonitorHistory, loadMonitorHistory, saveMonitorHistory } from "./history.js";
import { loadAlertLimits, saveAlertLimits } from "./alert-limits.js";
import { advanceAgentState, agentDecision, createAgentRuntimeState } from "./agent-runtime.js";
import { escapeHtml as h, safeExternalUrl } from "./html.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const formatMoney = (value) => value === null || value === undefined ? "Unavailable" : money.format(value);
const formatPct = (value, digits = 1) => value === null || value === undefined ? "Unavailable" : `${value.toFixed(digits)}%`;
const shortId = (value) => value && value.startsWith("0x") && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value || "Unavailable";
const explorerAddress = (address) => address ? `https://arc.etherscan.io/address/${address}` : null;
const infoTip = (text) => `<span class="info-tip" tabindex="0" role="note" aria-label="${h(text)}">i<span class="info-card">${h(text)}</span></span>`;
const identityValue = (label, value, url = null) => `<div><span>${h(label)}</span>${url ? `<a href="${h(safeExternalUrl(url))}" target="_blank" rel="noreferrer" title="${h(value)}">${h(shortId(value))} ↗</a>` : `<b title="${h(value || "")}">${h(shortId(value))}</b>`}</div>`;
const app = document.querySelector("#app");
let markets = demoMarkets;
let selectedId = markets[0].id;
let selectedPolicyId = "balanced";
let feedState = { mode: "loading", message: "Connecting to Morpho on Arc…" };
let activePolicy = policyProfiles[selectedPolicyId];
let agentScan = scanMarkets(markets, (market) => evaluateMarket(market, activePolicy));
let agentState = "idle";
let simulationAmount = 100_000;
let simulationHasRun = false;
let monitoring = { state: "baseline", materialChanges: 0, changes: [] };
let monitoringHistory = loadMonitorHistory(window.localStorage);
let alertLimits = loadAlertLimits(window.localStorage);
let runtimeState = createAgentRuntimeState();
let runtimeIntervalMinutes = 5;
let runtimeTimer = null;
let serverRuntime = { mode: "checking", configured: false, capabilities: {}, status: null, history: [], acknowledgment: null };
let receiptVerification = null;

const runtimeTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

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
  const simulation = simulationHasRun ? simulateBorrow(market, simulationAmount, activePolicy) : null;
  const simulationReceipt = simulation?.ok ? createSimulationReceipt(market, simulation, activePolicy) : null;
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
        <aside class="hero-note ${feedState.mode}"><b>${feedState.mode === "live" ? "LIVE ARC DATA" : feedState.mode === "loading" ? "CONNECTING" : "SAFE FALLBACK"}</b><p>${h(feedState.message)}</p></aside>
      </section>

      <section class="agent-panel" aria-labelledby="agent-title">
        <div class="agent-head">
          <div><p class="eyebrow">BOUNDED AGENT · NO EXECUTION</p><h2 id="agent-title">Scout every market. ${infoTip("Evaluates and ranks every loaded market with the same visible policy. It cannot sign or execute transactions.")}</h2><p>The agent applies the same public policy to every observation, ranks the results and exposes the first reason that needs attention.</p></div>
          <div class="agent-actions">
            <button class="receipt-button" type="button">DOWNLOAD RECEIPT</button>
            <button class="verify-receipt-button" type="button">VERIFY RECEIPT FILE</button>
            <input class="receipt-file-input" type="file" accept="application/json,.json" hidden>
            <button class="scan-button" type="button" ${agentState === "scanning" ? "disabled" : ""}>${agentState === "scanning" ? "SCANNING…" : "RUN NEW SCAN"}</button>
          </div>
        </div>
        ${receiptVerification ? `<div class="receipt-verification ${receiptVerification.valid ? "valid" : "invalid"}" role="status">
          <div><span>RECEIPT FILE VERIFICATION</span><b>${receiptVerification.valid ? "AUTHENTIC CONTENT" : "VERIFICATION FAILED"}</b></div>
          <p>${h(receiptVerification.reason)}${receiptVerification.fileName ? ` File: ${h(receiptVerification.fileName)}.` : ""}</p>
          ${receiptVerification.computedHash ? `<code>SHA-256 ${h(receiptVerification.computedHash)}</code>` : ""}
        </div>` : ""}
        <div class="policy-selector">
          <label for="policy-profile"><span>ACTIVE POLICY PROFILE ${infoTip("Changes the risk limits used to evaluate the same market data. It does not change the market itself.")}</span><b>${activePolicy.name}</b><small>${activePolicy.description}</small></label>
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
        <div class="agent-runtime ${runtimeState.enabled ? "armed" : ""}">
          <div class="runtime-title"><span>AGENT MODE · SESSION RUNTIME ${infoTip("Runs repeated scans only while this browser tab remains active. Choose 1, 5 or 15 minute intervals.")}</span><b>${runtimeState.enabled ? "AUTONOMOUS MONITORING ON" : "AUTONOMOUS MONITORING OFF"}</b><small>Observe → evaluate → decide → record. No execution authority.</small></div>
          <div class="runtime-status"><span>CURRENT PHASE</span><b>${h(runtimeState.phase)}</b><small>${h(runtimeState.lastDecision)}</small></div>
          <div class="runtime-metric"><span>CYCLES</span><b>${runtimeState.cycles}</b><small>Last ${runtimeTime(runtimeState.lastRunAt)}</small></div>
          <div class="runtime-metric"><span>NEXT RUN</span><b>${runtimeTime(runtimeState.nextRunAt)}</b><small>While this page remains open</small></div>
          <label class="runtime-frequency">FREQUENCY<select id="runtime-frequency"><option value="1" ${runtimeIntervalMinutes === 1 ? "selected" : ""}>Every 1 min</option><option value="5" ${runtimeIntervalMinutes === 5 ? "selected" : ""}>Every 5 min</option><option value="15" ${runtimeIntervalMinutes === 15 ? "selected" : ""}>Every 15 min</option></select></label>
          <button class="runtime-toggle" type="button">${runtimeState.enabled ? "STOP AGENT" : "START AGENT"}</button>
        </div>
        <div class="server-runtime ${serverRuntime.configured && serverRuntime.status && !serverRuntime.status.error ? "online" : serverRuntime.status?.error ? "degraded" : "setup"}">
          <div><span>SERVER AGENT · 24/7 CORE ${infoTip("Shows whether unattended monitoring, durable memory and protected scheduling are actually configured on the deployment.")}</span><b>${serverRuntime.mode === "checking" ? "CHECKING RUNTIME…" : serverRuntime.configured ? (serverRuntime.status?.error ? "AGENT DEGRADED · SOURCE FAILURE" : serverRuntime.status ? "DURABLE AGENT ONLINE" : "READY FOR FIRST SCHEDULED RUN") : "DEPLOYMENT SETUP REQUIRED"}</b></div>
          <div><span>LAST SERVER RUN</span><b>${runtimeTime(serverRuntime.status?.ranAt)}</b></div>
          <div><span>${serverRuntime.status?.error ? "LAST SOURCE DIAGNOSTIC" : "LAST DECISION"}</span><b>${h(serverRuntime.status?.error ? `${serverRuntime.status.source?.provider ?? "DATA SOURCE"} · ${serverRuntime.status.source?.code ?? "ERROR"}` : serverRuntime.status?.decision?.action ?? "—")}</b><small>${h(serverRuntime.status?.error ?? serverRuntime.status?.decision?.reason ?? "Connect the protected durable store to activate unattended history.")}</small></div>
          <div><span>DURABLE HISTORY</span><b>${serverRuntime.history?.length ?? 0} CYCLES</b><small>Stored independently of this browser</small></div>
          ${serverRuntime.status?.verification ? `<div class="rpc-verification ${h(serverRuntime.status.verification.status)}"><span>INDEPENDENT ARC RPC CHECK</span><b>${h(serverRuntime.status.verification.status.toUpperCase())}</b><small>${serverRuntime.status.verification.status === "verified" ? `${h(serverRuntime.status.verification.marketsVerified)} / ${h(serverRuntime.status.verification.marketCount)} markets · ${h(serverRuntime.status.verification.contractsChecked)} unique contracts contain bytecode` : h(serverRuntime.status.verification.error ?? "Some market contracts could not be independently confirmed.")}</small></div>` : ""}
          ${serverRuntime.status?.trace?.length ? `<div class="execution-trace"><span>LAST AGENT EXECUTION TRACE</span><ol>${serverRuntime.status.trace.map((step) => `<li class="${h(step.status.toLowerCase())}"><b>${h(step.phase)}</b><small>${h(step.status)} · ${h(step.detail)}</small></li>`).join("")}</ol></div>` : ""}
          <div class="runtime-capabilities"><span>DEPLOYMENT CAPABILITIES</span><div>${[
            ["MEMORY", serverRuntime.capabilities?.durableMemory],
            ["SCHEDULER", serverRuntime.capabilities?.protectedScheduler],
            ["ALERTS", serverRuntime.capabilities?.outboundAlerts],
            ["GEMINI", serverRuntime.capabilities?.boundedIntelligence],
            ["HUMAN ACK", serverRuntime.capabilities?.humanAcknowledgment],
            ["ARC RPC", serverRuntime.capabilities?.arcRpcVerification],
            ["ARC ANCHOR", serverRuntime.capabilities?.onchainAnchor]
          ].map(([label, enabled]) => `<b class="${enabled ? "ready" : "optional"}">${label} · ${enabled ? "READY" : "OFF"}</b>`).join("")}</div></div>
          ${serverRuntime.status?.intelligence ? `<div class="server-analysis"><span>BOUNDED INTELLIGENCE · ${serverRuntime.status.intelligence.source === "gemini" ? "GEMINI" : "DETERMINISTIC"}</span><b>${h(serverRuntime.status.intelligence.priority)} · ${h(serverRuntime.status.intelligence.recommendedAction)}</b><small>${h(serverRuntime.status.intelligence.summary)}</small></div>` : ""}
          ${serverRuntime.status?.alert ? `<div class="operator-review"><span>HUMAN OVERSIGHT</span><b>${serverRuntime.acknowledgment?.fingerprint === serverRuntime.status.alert.fingerprint ? `ACKNOWLEDGED BY ${h(serverRuntime.acknowledgment.operator)}` : "OPERATOR ACKNOWLEDGMENT REQUIRED"}</b><small>${serverRuntime.acknowledgment?.fingerprint === serverRuntime.status.alert.fingerprint ? `${runtimeTime(serverRuntime.acknowledgment.acknowledgedAt)} · ${h(serverRuntime.acknowledgment.note || "No note")}` : "A protected operator token is required. The agent cannot acknowledge itself."}</small>${serverRuntime.acknowledgment?.fingerprint === serverRuntime.status.alert.fingerprint ? "" : `<button class="acknowledge-alert" type="button" data-fingerprint="${h(serverRuntime.status.alert.fingerprint)}">ACKNOWLEDGE ALERT</button>`}</div>` : ""}
        </div>
        <div class="monitoring">
          <div><span>SNAPSHOT MONITOR ${infoTip("Compares consecutive scans and flags market listings, policy status, liquidity or utilization changes above your alert limits.")}</span><b>${monitoring.state === "compared" ? `${monitoring.materialChanges} MATERIAL CHANGE${monitoring.materialChanges === 1 ? "" : "S"}` : "BASELINE READY"}</b></div>
          <p>${h(monitoring.state === "compared" ? (monitoring.changes[0]?.message ?? "No material liquidity, utilization or policy changes detected.") : "Run a new scan to compare fresh Arc data against this snapshot.")}</p>
          ${monitoring.state === "compared" && monitoring.changes.length ? `<div class="monitor-list">${monitoring.changes.slice(0, 4).map((change) => `<button type="button" data-id="morpho-${h(change.marketId)}" class="monitor-item ${change.level}"><b>${h(change.market)}</b><span>${h(change.message)}</span></button>`).join("")}</div>` : ""}
          <form class="alert-limits">
            <span>CHANGE ALERT LIMITS</span>
            <label>LIQUIDITY CHANGE %<input name="liquidity" type="number" min="0.1" step="0.1" value="${alertLimits.liquidityChangePct}"></label>
            <label>UTILIZATION POINTS<input name="utilization" type="number" min="0.1" step="0.1" value="${alertLimits.utilizationChangePts}"></label>
            <button type="submit">SAVE LIMITS</button>
          </form>
          <div class="history-head"><span>HISTORICAL OBSERVATIONS · THIS BROWSER</span>${monitoringHistory.length ? `<button class="clear-history" type="button">CLEAR</button>` : ""}</div>
          <div class="history-list">
            ${monitoringHistory.length ? monitoringHistory.map((entry) => `<details class="history-entry" ${entry === monitoringHistory[0] ? "open" : ""}>
              <summary><time>${h(new Date(entry.scannedAt).toLocaleString())}</time><b>${entry.materialChanges} MATERIAL CHANGE${entry.materialChanges === 1 ? "" : "S"}</b></summary>
              <div>${entry.changes.length ? entry.changes.map((change) => `<p><strong>${h(change.market)}</strong><span>${h(change.message)}</span></p>`).join("") : `<p><span>No material changes detected in this scan.</span></p>`}</div>
            </details>`).join("") : `<p class="history-empty">Run another scan to create the first comparison record.</p>`}
          </div>
        </div>
        <div class="agent-ranking">
          ${agentScan.ranked.map((item, index) => `<button class="agent-market" data-id="${h(item.market.id)}" type="button">
            <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
            <span><b>${h(item.market.name)}</b><small class="market-id">ID ${h(shortId(item.market.marketId))}</small><small>${h(item.reason)}</small></span>
            <strong class="rank-status ${item.report.status.toLowerCase()}">${item.report.status} · ${item.report.score}</strong>
          </button>`).join("")}
        </div>
        <footer><span>RECEIPT ${receipt.receiptId} · SHA-256 ${receipt.integrity.contentHash.slice(0, 12)}…</span><span>${receiptVerification ? (receiptVerification.valid ? "✓ RECEIPT VERIFIED" : "× RECEIPT INVALID") : `${agentScan.actionable} market${agentScan.actionable === 1 ? "" : "s"} currently clear every active check`}</span></footer>
      </section>

      <section class="workspace">
        <nav class="market-list" aria-label="Markets">
          <div class="section-label">SELECT A MARKET</div>
          ${markets.map((item) => `<button class="market-button ${item.id === selectedId ? "active" : ""}" data-id="${h(item.id)}">
            <span class="asset-icon">${h(item.symbol.slice(0, 2))}</span>
            <span><b>${h(item.name)}</b><small>${h(item.protocol)} · ${h(item.category)}</small><small class="market-id">ID ${h(shortId(item.marketId))}</small></span>
            <span class="chevron">→</span>
          </button>`).join("")}
          <div class="policy-card"><span>POLICY</span><b>${activePolicy.version}</b><small>8 deterministic checks</small></div>
        </nav>

        <article class="report">
          <div class="report-head">
            <div><span class="category">${h(market.category)}</span><h2>${h(market.name)} ${infoTip("Confirm the Market ID and contract addresses: markets with the same asset pair may use different parameters or oracles.")}</h2><p>${h(market.protocol)} · ${h(market.network)}</p></div>
            <div class="verdict ${report.status.toLowerCase()}"><span>${report.status}</span><b>${report.score}</b><small>/ 100</small></div>
          </div>

          <div class="summary ${report.status.toLowerCase()}"><b>${h(report.summary)}</b><span>${h(market.note)}</span></div>

          <div class="metrics">
            <div><span>LIQUIDITY ${infoTip("Currently available market liquidity. Low liquidity may limit exits or make one borrow materially change utilization.")}</span><b>${formatMoney(market.liquidityUsd)}</b></div>
            <div><span>UTILIZATION ${infoTip("Share of supplied assets already borrowed. Higher utilization generally leaves less available liquidity.")}</span><b>${formatPct(market.utilizationPct)}</b></div>
            <div><span>SUPPLY APY ${infoTip("Observed annualized supply rate. It is variable and is not a guaranteed return.")}</span><b>${formatPct(market.apyPct, 3)}</b></div>
            <div><span>DATA AGE ${infoTip("Age of the normalized observation. Fresh data can still be incomplete or incorrect.")}</span><b>${market.ageMinutes} min</b></div>
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
            <div class="comparison-head"><h3 id="comparison-title">Policy comparison ${infoTip("Compares the same inputs under conservative, balanced and yield-oriented limits. A looser profile does not verify missing data.")}</h3><span>Same market · three visible bounds</span></div>
            <div class="comparison-grid">
              ${profileComparison.map(({ profile, report: profileReport }) => `<div class="comparison-card ${profile.id === selectedPolicyId ? "active" : ""}">
                <span>${profile.name}</span>
                <b class="${profileReport.status.toLowerCase()}">${profileReport.status} · ${profileReport.score}</b>
                <small>${h(profileReport.warnings[0]?.detail ?? "Every active check passed.")}</small>
              </div>`).join("")}
            </div>
          </section>

          <section class="simulator" aria-labelledby="simulator-title">
            <div class="simulator-copy">
              <span>READ-ONLY ACTION SIMULATION</span>
              <h3 id="simulator-title">Preview a hypothetical borrow. ${infoTip("Recalculates liquidity, utilization and policy result without preparing, signing or submitting a transaction.")}</h3>
              <p>Estimate the immediate liquidity and utilization impact before any wallet or transaction exists.</p>
            </div>
            <form class="simulation-form">
              <label for="borrow-amount">USD EQUIVALENT</label>
              <div><input id="borrow-amount" name="amount" type="number" min="0.01" step="any" value="${simulationAmount}"><button type="submit">${simulationHasRun ? "SIMULATED ✓" : "SIMULATE"}</button>${simulationReceipt ? `<button class="simulation-download" type="button">DOWNLOAD SIMULATION</button>` : ""}</div>
            </form>
            ${!simulationHasRun ? `<p class="simulation-pending">Enter an amount and press SIMULATE to generate a projected market state.</p>` : simulation.ok ? `<div class="simulation-outcome ${simulation.before.report.status === simulation.after.report.status ? "unchanged" : "changed"}">
              <b>SIMULATION RESULT · ${formatMoney(simulation.amountUsd)}</b>
              <span>A ${formatMoney(simulation.amountUsd)} hypothetical borrow reduces available liquidity by ${formatMoney(simulation.amountUsd)} and changes utilization by ${(simulation.after.utilizationPct - simulation.before.utilizationPct).toFixed(4)} percentage points. Policy result ${simulation.before.report.status === simulation.after.report.status ? `remains ${simulation.after.report.status}` : `changes from ${simulation.before.report.status} to ${simulation.after.report.status}`}.</span>
            </div><div class="simulation-results">
              <div><span>AVAILABLE LIQUIDITY</span><b>${formatMoney(simulation.before.liquidityUsd)}</b><i>→</i><strong>${formatMoney(simulation.after.liquidityUsd)}</strong></div>
              <div><span>UTILIZATION</span><b>${formatPct(simulation.before.utilizationPct, 3)}</b><i>→</i><strong>${formatPct(simulation.after.utilizationPct, 3)}</strong></div>
              <div><span>POLICY RESULT</span><b class="${simulation.before.report.status.toLowerCase()}">${simulation.before.report.status}</b><i>→</i><strong class="${simulation.after.report.status.toLowerCase()}">${simulation.after.report.status} · ${simulation.after.report.score}</strong></div>
            </div>` : `<p class="simulation-error">${simulation.error}</p>`}
            <div class="simulation-foot"><small class="simulation-notice">Simulation only · No custody · No signature · No transaction</small></div>
          </section>

          <div class="checks-head"><h3>Policy checks ${infoTip("Eight deterministic checks produce PASS, REVIEW or REJECT. The score is policy compliance, not a probability of safety.")}</h3><span>Same inputs → same result</span></div>
          <div class="checks">
            ${report.rules.map((item) => `<div class="check">
              <span class="signal ${item.outcome}">${item.outcome === "pass" ? "✓" : item.outcome === "review" ? "!" : "×"}</span>
              <div><b>${h(item.label)}</b><small>${h(item.detail)}</small></div>
              <strong>${h(valueFor(item))}</strong>
            </div>`).join("")}
          </div>

          <footer class="source-row">
            <div><span>SOURCE</span><b>${h(market.source)}</b></div>
            <div><span>OBSERVED</span><b>${h(market.observedAt)}</b></div>
            <a href="${h(safeExternalUrl(market.sourceUrl))}" target="_blank" rel="noreferrer">Open Arc explorer ↗</a>
          </footer>
        </article>
      </section>
    </main>
    <footer class="site-footer"><span>Research first. Execution later.</span><span>Experimental software · Not financial advice</span></footer>`;

  document.querySelectorAll(".market-button").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    render();
  }));
  document.querySelectorAll(".agent-market").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    render();
    document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.querySelectorAll(".monitor-item").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    render();
    document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.querySelector(".scan-button")?.addEventListener("click", () => refreshMarkets());
  document.querySelector("#runtime-frequency")?.addEventListener("change", (event) => {
    runtimeIntervalMinutes = Number(event.target.value);
    if (runtimeState.enabled) scheduleAgentCycle();
    render();
  });
  document.querySelector(".runtime-toggle")?.addEventListener("click", () => {
    runtimeState = advanceAgentState(runtimeState, runtimeState.enabled ? "STOP" : "START");
    if (runtimeState.enabled) {
      scheduleAgentCycle();
      refreshMarkets({ agentCycle: true });
    } else {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }
    render();
  });
  document.querySelector(".clear-history")?.addEventListener("click", () => {
    monitoringHistory = clearMonitorHistory(window.localStorage);
    render();
  });
  document.querySelector(".alert-limits")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    alertLimits = saveAlertLimits(window.localStorage, {
      liquidityChangePct: Number(values.get("liquidity")),
      utilizationChangePts: Number(values.get("utilization"))
    });
    monitoring = { state: "baseline", materialChanges: 0, changes: [] };
    render();
  });
  document.querySelector(".receipt-button")?.addEventListener("click", () => downloadScoutReceipt(receipt));
  document.querySelector(".verify-receipt-button")?.addEventListener("click", () => document.querySelector(".receipt-file-input")?.click());
  document.querySelector(".receipt-file-input")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const importedReceipt = JSON.parse(await file.text());
      receiptVerification = { ...verifyReceiptDocument(importedReceipt), fileName: file.name };
    } catch {
      receiptVerification = { valid: false, reason: "The selected file is not valid JSON.", fileName: file.name };
    }
    render();
  });
  document.querySelector("#policy-profile")?.addEventListener("change", (event) => {
    selectedPolicyId = event.target.value;
    receiptVerification = null;
    activePolicy = policyProfiles[selectedPolicyId];
    agentScan = scanMarkets(markets, (item) => evaluateMarket(item, activePolicy));
    monitoring = { state: "baseline", materialChanges: 0, changes: [] };
    simulationHasRun = false;
    render();
  });
  document.querySelector(".simulation-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    simulationAmount = Number(new FormData(event.currentTarget).get("amount"));
    simulationHasRun = true;
    render();
  });
  document.querySelector(".simulation-download")?.addEventListener("click", () => downloadScoutReceipt(simulationReceipt));
  document.querySelector(".acknowledge-alert")?.addEventListener("click", async (event) => {
    const operator = window.prompt("Operator name");
    if (!operator) return;
    const token = window.prompt("Protected operator token (not stored)");
    if (!token) return;
    const note = window.prompt("Review note (optional)") ?? "";
    const response = await fetch("/api/agent/acknowledge", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: event.currentTarget.dataset.fingerprint, operator, note })
    });
    const result = await response.json();
    if (!response.ok) window.alert(result.error ?? "Acknowledgment failed.");
    await loadServerRuntimeStatus();
  });
}

function scheduleAgentCycle() {
  clearInterval(runtimeTimer);
  const delay = runtimeIntervalMinutes * 60_000;
  runtimeState = { ...runtimeState, nextRunAt: new Date(Date.now() + delay).toISOString() };
  runtimeTimer = setInterval(() => refreshMarkets({ agentCycle: true }), delay);
}

async function refreshMarkets({ agentCycle = false } = {}) {
  receiptVerification = null;
  const previousLiveMarkets = markets.every((market) => market.dataMode === "live") ? markets : null;
  if (agentCycle) runtimeState = advanceAgentState(runtimeState, "OBSERVE");
  agentState = "scanning";
  feedState = { mode: "loading", message: "Scout Agent is requesting a fresh Arc market snapshot…" };
  render();

  try {
    const liveMarkets = await fetchMorphoArcMarkets();
    if (agentCycle) runtimeState = advanceAgentState(runtimeState, "EVALUATE");
    markets = liveMarkets;
    if (previousLiveMarkets) {
      const comparison = compareMarketSnapshots(previousLiveMarkets, liveMarkets, activePolicy, evaluateMarket, alertLimits);
      monitoring = { state: "compared", ...comparison };
      monitoringHistory = addMonitorObservation(monitoringHistory, comparison);
      saveMonitorHistory(window.localStorage, monitoringHistory);
    } else {
      monitoring = { state: "baseline", materialChanges: 0, changes: [] };
    }
    if (!markets.some((market) => market.id === selectedId)) {
      selectedId = liveMarkets[0].id;
      simulationAmount = suggestedBorrowAmount(liveMarkets[0]);
    }
    agentScan = scanMarkets(liveMarkets, (market) => evaluateMarket(market, activePolicy));
    if (agentCycle) {
      const decision = agentDecision(monitoring.state === "compared" ? monitoring : { changes: [] }, agentScan);
      runtimeState = advanceAgentState(runtimeState, "DECIDE", { decision });
      runtimeState = advanceAgentState(runtimeState, "RECORDED", {
        decision,
        nextRunAt: runtimeState.enabled ? new Date(Date.now() + runtimeIntervalMinutes * 60_000).toISOString() : null
      });
    }
    feedState = { mode: "live", message: `${liveMarkets.length} listed Morpho markets loaded from Arc mainnet.` };
  } catch (error) {
    console.warn("Scout live adapter unavailable:", error);
    markets = demoMarkets;
    monitoring = { state: "baseline", materialChanges: 0, changes: [] };
    selectedId = markets[0].id;
    agentScan = scanMarkets(markets, (market) => evaluateMarket(market, activePolicy));
    feedState = { mode: "fallback", message: "Live data is unavailable. Showing clearly labeled demonstration observations." };
    if (agentCycle) runtimeState = advanceAgentState(runtimeState, "FAIL", { error: error.message });
  } finally {
    agentState = "idle";
    render();
  }
}

async function loadServerRuntimeStatus() {
  try {
    const response = await fetch("/api/agent/status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Status request failed (${response.status}).`);
    const payload = await response.json();
    serverRuntime = { mode: "ready", configured: payload.configured === true, capabilities: payload.capabilities ?? {}, status: payload.status, history: payload.history ?? [], acknowledgment: payload.acknowledgment ?? null };
  } catch {
    serverRuntime = { mode: "unavailable", configured: false, capabilities: {}, status: null, history: [], acknowledgment: null };
  }
  render();
}

render();
refreshMarkets();
loadServerRuntimeStatus();
