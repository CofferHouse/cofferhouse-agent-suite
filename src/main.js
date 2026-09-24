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
import { agentCatalog } from "./agent-catalog.js";
import { analyzeOpportunities, defaultOpportunityPreferences, loadOpportunityPreferences, saveOpportunityPreferences } from "./opportunity.js";
import { createOpportunityReceipt } from "./opportunity-receipt.js";
import { buildStrategy, defaultStrategyPreferences, loadStrategyPreferences, saveStrategyPreferences } from "./strategy.js";
import { createStrategyReceipt } from "./strategy-receipt.js";
import { evaluateDexPool, isEvmAddress, loadDexWatchlist, saveDexWatchlist } from "./dex-pools.js";
import { fetchArcPoolsForToken } from "./dex-provider.js";
import { createDexReceipt } from "./dex-receipt.js";
import { ARC_USDC, requestUniswapQuote } from "./uniswap-quote.js";
import { analyzeDexOpportunities, loadDexOpportunityPreferences, saveDexOpportunityPreferences } from "./dex-opportunity.js";
import { buildDexStrategy, loadDexStrategyPreferences, saveDexStrategyPreferences } from "./dex-strategy.js";
import { createDexOpportunityReceipt, createDexStrategyReceipt } from "./dex-research-receipt.js";
import { createActionApproval, createActionPreview } from "./action-center.js";
import { createActionReceipt } from "./action-receipt.js";
import { createGuardianWatch, evaluateGuardian, guardianEvidenceFromDex, guardianEvidenceFromLending } from "./guardian.js";
import { createGuardianReceipt } from "./guardian-receipt.js";
import { createPermissionPolicy, evaluatePermissionRequest, pausePermissionPolicy, revokePermissionPolicy } from "./automation.js";
import { createAutomationReceipt } from "./automation-receipt.js";

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
let opportunityPreferences = loadOpportunityPreferences(window.localStorage);
let strategyPreferences = loadStrategyPreferences(window.localStorage);
let dexWatchlist = loadDexWatchlist(window.localStorage);
let dexPools = [];
let dexState = { mode: "idle", message: "Add an Arc token contract to discover its indexed DEX pools." };
let dexModeledSwapUsd = 1_000;
let dexSlippageTolerancePct = 0.5;
let dexQuotes = {};
let dexOpportunityPreferences = loadDexOpportunityPreferences(window.localStorage);
let dexStrategyPreferences = loadDexStrategyPreferences(window.localStorage);
let actionPreview = null;
let actionApproval = null;
let actionMessage = "Select a modeled position to create a read-only action preview.";
let guardianWatch = null;
let guardianObservation = null;
let automationPolicy = null;
let automationEvaluation = null;
let activeSuiteView = "hub";

const suiteTabs = Object.freeze([
  { id: "hub", label: "Agent Hub", mark: "⌂" },
  { id: "scout", label: "Scout", mark: "01" },
  { id: "opportunity", label: "Opportunities", mark: "02" },
  { id: "strategy", label: "Strategy", mark: "03" },
  { id: "dex", label: "DEX", mark: "04" },
  { id: "action", label: "Action Center", mark: "05" },
  { id: "guardian", label: "Guardian", mark: "06" },
  { id: "automation", label: "Automation", mark: "07" }
]);

const agentDoodles = Object.freeze({
  scout: "⌕",
  opportunity: "✦",
  strategy: "▦",
  dex: "⇄",
  action: "✓",
  guardian: "◇",
  automation: "⚙"
});

const requestedSuiteView = window.location.hash.match(/^#agents\/(.+)$/)?.[1];
if (suiteTabs.some((tab) => tab.id === requestedSuiteView)) activeSuiteView = requestedSuiteView;

function openSuiteView(view) {
  if (!suiteTabs.some((tab) => tab.id === view)) return;
  activeSuiteView = view;
  window.history.replaceState(null, "", view === "hub" ? "#agents" : `#agents/${view}`);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
  const opportunityAnalysis = analyzeOpportunities(markets, activePolicy, opportunityPreferences);
  const opportunityReceipt = createOpportunityReceipt(opportunityAnalysis);
  const strategyProposal = buildStrategy(opportunityAnalysis, strategyPreferences);
  const strategyReceipt = createStrategyReceipt(strategyProposal);
  const dexReports = dexPools.map((pool) => evaluateDexPool(pool, undefined, dexModeledSwapUsd)).sort((a, b) => b.score - a.score || (b.pool.liquidityUsd ?? -1) - (a.pool.liquidityUsd ?? -1));
  const dexReceipt = createDexReceipt(dexReports, dexWatchlist, dexModeledSwapUsd);
  const dexOpportunityAnalysis = analyzeDexOpportunities(dexReports, dexOpportunityPreferences, dexQuotes);
  const dexStrategyProposal = buildDexStrategy(dexOpportunityAnalysis, dexStrategyPreferences);
  const dexOpportunityReceipt = createDexOpportunityReceipt(dexOpportunityAnalysis);
  const dexStrategyReceipt = createDexStrategyReceipt(dexStrategyProposal);
  const actionChoices = [
    ...strategyProposal.positions.map((position, index) => ({ key: `LENDING:${index}`, source: "LENDING", position, receiptId: strategyReceipt.receiptId, label: `Lending · ${position.marketName} · ${formatMoney(position.amountUsd)}` })),
    ...dexStrategyProposal.positions.map((position, index) => ({ key: `${dexStrategyProposal.mode === "LP" ? "DEX_LP" : "DEX_SWAP"}:${index}`, source: dexStrategyProposal.mode === "LP" ? "DEX_LP" : "DEX_SWAP", position, receiptId: dexStrategyReceipt.receiptId, label: `${dexStrategyProposal.mode} · ${position.pairName} · ${formatMoney(position.amountUsd)}` }))
  ];
  const actionReceipt = actionPreview ? createActionReceipt(actionPreview, actionApproval) : null;
  let currentGuardianEvidence = null;
  if (actionPreview?.source === "LENDING") {
    const watchedMarket = markets.find((item) => item.marketId?.toLowerCase() === actionPreview.target.id?.toLowerCase());
    if (watchedMarket) currentGuardianEvidence = guardianEvidenceFromLending(watchedMarket, evaluateMarket(watchedMarket, activePolicy));
  } else if (actionPreview) {
    const watchedPool = dexReports.find((item) => item.pool.pairAddress?.toLowerCase() === actionPreview.target.id?.toLowerCase());
    if (watchedPool) currentGuardianEvidence = guardianEvidenceFromDex(watchedPool);
  }
  const guardianReceipt = guardianWatch && guardianObservation ? createGuardianReceipt(guardianWatch, guardianObservation) : null;
  const automationReceipt = automationPolicy ? createAutomationReceipt(automationPolicy, automationEvaluation) : null;
  app.innerHTML = `
    <header class="topbar">
      <a class="brand suite-home" href="#agents" aria-label="CofferHouse Agent Suite">
        <img class="brand-arch" src="/brand/cofferhouse-arch-official.png" alt="">
        <strong class="brand-name" aria-hidden="true"><i>C</i><i>O</i><i>F</i><i>F</i><i>E</i><i>R</i><i>H</i><i>O</i><i>U</i><i>S</i><i>E</i></strong>
        <span>AGENT SUITE</span>
      </a>
      <div class="topbar-room"><span>ROOM 02</span><b>THE AGENT ROOM</b></div>
      <div class="network"><span></span> ARC MAINNET · READ ONLY</div>
    </header>
    <nav class="suite-nav" aria-label="CofferHouse Agent Suite">
      <div class="suite-nav-inner">
        ${suiteTabs.map((tab) => `<button class="suite-tab ${activeSuiteView === tab.id ? "active" : ""}" data-view="${tab.id}" type="button" aria-current="${activeSuiteView === tab.id ? "page" : "false"}"><span>${tab.mark}</span>${tab.label}</button>`).join("")}
      </div>
    </nav>
    <main>
      <section class="hero suite-view ${activeSuiteView === "hub" ? "is-active" : ""}" data-suite-view="hub">
        <div>
          <p class="eyebrow">WELCOME TO THE AGENT ROOM</p>
          <h1>Meet the House<br><em>agents.</em></h1>
          <p class="intro">Seven small jobs, one careful path. They watch Arc markets, compare evidence and prepare decisions—while you keep the final say.</p>
        </div>
        <aside class="hero-note house-host ${feedState.mode}">
          <img src="/brand/cofferhouse-arch-official.png" alt="" aria-hidden="true">
          <div><span>THE HOUSE HOST</span><b>I KEEP THE AGENTS TOGETHER.</b><p>Start here. I will show what is watching, what needs attention and what still needs your approval.</p></div>
          <footer><i></i>${feedState.mode === "live" ? "LIVE ARC DATA" : feedState.mode === "loading" ? "CONNECTING TO ARC" : "SAFE DEMO DATA"}</footer>
        </aside>
      </section>

      <section class="agent-hub suite-view ${activeSuiteView === "hub" ? "is-active" : ""}" data-suite-view="hub" id="agent-hub" aria-labelledby="agent-hub-title">
        <div class="hub-head">
          <div><p class="eyebrow">THE HOUSE CONTROL DESK</p><h2 id="agent-hub-title">Every helper has one job. ${infoTip("The Hub shows what each agent does and how evidence moves through the suite without granting any agent custody or signing power.")}</h2></div>
          <p>Open any agent from the cards or the tabs above. Their work stays connected, but their responsibilities never blur together.</p>
        </div>
        <div class="hub-overview" aria-label="Agent Suite status">
          <div><span>ACTIVE MODULES</span><b>7</b><small>Bounded research agents</small></div>
          <div><span>MARKETS OBSERVED</span><b>${agentScan.total}</b><small>${agentScan.counts.REVIEW} review · ${agentScan.counts.REJECT} reject</small></div>
          <div><span>DEX WATCHLIST</span><b>${dexWatchlist.length}</b><small>${dexReports.length} pool observations</small></div>
          <div><span>HUMAN GATE</span><b>${actionApproval ? "RECORDED" : "READY"}</b><small>No wallet authority</small></div>
        </div>
        <div class="hub-flow" aria-label="Agent development sequence">
          ${agentCatalog.map((agent) => `<article class="hub-agent hub-${h(agent.id)} ${h(agent.tone)} ${agent.available ? "available" : "locked"}">
            <div class="agent-doodle" aria-hidden="true">${agentDoodles[agent.id] ?? "·"}</div>
            <div class="hub-agent-top"><span class="hub-order">JOB ${String(agent.order).padStart(2, "0")}</span><span class="hub-stage">${h(agent.stage)}</span></div>
            <h3>${h(agent.name)}</h3>
            <p>${h(agent.role)}</p>
            <div class="hub-output"><span>OUTPUT</span><small>${h(agent.output)}</small></div>
            ${agent.available ? `<button class="hub-open-agent" data-target="${h(agent.id)}-agent" type="button">OPEN ${h(agent.name.toUpperCase())} ↓</button>` : `<span class="hub-roadmap-label">${agent.stage === "NEXT BUILD" ? "CURRENT PRODUCT TASK" : "ROADMAP · NOT ACTIVE"}</span>`}
          </article>`).join("")}
        </div>
        <footer class="hub-boundary"><b>CURRENT BOUNDARY</b><span>Scout can observe, verify, evaluate, compare, alert, simulate and record. No agent can custody, sign or execute.</span></footer>
      </section>

      <section class="agent-panel suite-view ${activeSuiteView === "scout" ? "is-active" : ""}" data-suite-view="scout" id="scout-agent" aria-labelledby="agent-title">
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
            ["UNISWAP QUOTES", serverRuntime.capabilities?.officialUniswapQuotes],
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

      <section class="opportunity-agent suite-view ${activeSuiteView === "opportunity" ? "is-active" : ""}" data-suite-view="opportunity" id="opportunity-agent" aria-labelledby="opportunity-title">
        <div class="opportunity-head">
          <div><p class="eyebrow">AGENT 02 · RESEARCH PRIORITIZATION</p><h2 id="opportunity-title">Opportunity Agent. ${infoTip("Filters Scout results through your visible research limits. It prioritizes candidates but does not recommend or execute an investment.")}</h2><p>Turn Scout evidence into a transparent shortlist without hiding blockers or missing data.</p></div>
          <button class="opportunity-download" type="button">DOWNLOAD OPPORTUNITY RECEIPT</button>
        </div>
        <div class="opportunity-summary">
          <div><span>MARKETS ANALYZED</span><b>${opportunityAnalysis.summary.total}</b></div>
          <div class="eligible"><span>ELIGIBLE FOR RESEARCH</span><b>${opportunityAnalysis.summary.eligible}</b></div>
          <div class="blocked"><span>BLOCKED BY LIMITS</span><b>${opportunityAnalysis.summary.blocked}</b></div>
          <div><span>DATA MODE</span><b>${h(opportunityAnalysis.dataMode.toUpperCase())}</b></div>
        </div>
        <form class="opportunity-preferences">
          <div class="opportunity-form-title"><span>YOUR RESEARCH LIMITS ${infoTip("These limits filter and size research candidates. They are not wallet permissions and do not move capital.")}</span><small>Saved only in this browser.</small></div>
          <label>CAPITAL TO RESEARCH · USD<input name="capitalUsd" type="number" min="1" step="1" value="${opportunityPreferences.capitalUsd}"></label>
          <label>MIN SUPPLY APY · %<input name="minSupplyApyPct" type="number" min="0" step="0.01" value="${opportunityPreferences.minSupplyApyPct}"></label>
          <label>MIN LIQUIDITY · USD<input name="minLiquidityUsd" type="number" min="0" step="1000" value="${opportunityPreferences.minLiquidityUsd}"></label>
          <label>MAX UTILIZATION · %<input name="maxUtilizationPct" type="number" min="1" max="100" step="0.1" value="${opportunityPreferences.maxUtilizationPct}"></label>
          <label>MAX LIQUIDITY IMPACT · %<input name="maxMarketImpactPct" type="number" min="0.01" max="10" step="0.01" value="${opportunityPreferences.maxMarketImpactPct}"></label>
          <div class="opportunity-form-actions"><button type="submit">APPLY LIMITS</button><button class="opportunity-reset" type="button">RESET</button></div>
        </form>
        <div class="opportunity-method"><b>RESEARCH SCORE, NOT SAFETY PROBABILITY</b><span>65% Scout policy score · 15% liquidity depth · 10% utilization buffer · 10% observed supply APY relevance.</span></div>
        <div class="opportunity-list">
          ${opportunityAnalysis.opportunities.map((item, index) => `<article class="opportunity-card ${item.eligible ? "eligible" : "blocked"}">
            <div class="opportunity-rank"><span>${String(index + 1).padStart(2, "0")}</span><b>${item.eligible ? "RESEARCH" : "BLOCKED"}</b></div>
            <div class="opportunity-copy"><h3>${h(item.marketName)}</h3><small>ID ${h(shortId(item.marketId))}</small><p>${h(item.reason)}</p></div>
            <div class="opportunity-numbers"><div><span>RESEARCH SCORE</span><b>${item.researchScore}</b></div><div><span>SUPPLY APY</span><b>${formatPct(item.supplyApyPct, 3)}</b></div><div><span>MAX RESEARCH SIZE</span><b>${formatMoney(item.maxResearchAmountUsd)}</b></div></div>
            <div class="opportunity-evidence"><span>SCOUT ${h(item.scoutStatus)} · ${item.scoutScore}/100</span><small>${h(item.blockers[0] ?? item.warnings[0] ?? "No active blocker detected.")}</small></div>
            <button class="opportunity-open-market" type="button" data-id="${h(item.selectedMarketId)}">INSPECT MARKET →</button>
          </article>`).join("")}
        </div>
        <footer><span>${opportunityAnalysis.summary.eligible} candidate${opportunityAnalysis.summary.eligible === 1 ? "" : "s"} clear your research limits</span><span>Human review required · No recommendation · No execution</span></footer>
      </section>

      <section class="strategy-agent suite-view ${activeSuiteView === "strategy" ? "is-active" : ""}" data-suite-view="strategy" id="strategy-agent" aria-labelledby="strategy-title">
        <div class="strategy-head">
          <div><p class="eyebrow">AGENT 03 · ALLOCATION RESEARCH</p><h2 id="strategy-title">Strategy Lab. ${infoTip("Transforms only Opportunity-eligible markets into a bounded allocation proposal. It cannot recommend, authorize or execute an investment.")}</h2><p>Explore how capital, reserve and concentration limits could distribute research exposure across eligible markets.</p></div>
          <button class="strategy-download" type="button">DOWNLOAD STRATEGY RECEIPT</button>
        </div>
        <div class="strategy-summary">
          <div><span>CAPITAL MODELED</span><b>${formatMoney(strategyProposal.summary.capitalUsd)}</b></div>
          <div class="allocated"><span>PROPOSED ALLOCATION</span><b>${formatMoney(strategyProposal.summary.allocatedUsd)}</b></div>
          <div><span>RESERVE</span><b>${formatMoney(strategyProposal.summary.reserveUsd)}</b></div>
          <div><span>MARKETS</span><b>${strategyProposal.summary.markets}</b></div>
          <div class="yield"><span>OBSERVED WEIGHTED APY</span><b>${formatPct(strategyProposal.summary.weightedObservedApyPct, 3)}</b></div>
        </div>
        <form class="strategy-preferences">
          <div class="strategy-form-title"><span>STRATEGY BOUNDS ${infoTip("These controls change only this read-only proposal. Reserve stays unallocated; concentration caps prevent one market from receiving too much modeled capital.")}</span><small>Saved only in this browser.</small></div>
          <label>CAPITAL · USD<input name="capitalUsd" type="number" min="1" step="1" value="${strategyPreferences.capitalUsd}"></label>
          <label>RESERVE · %<input name="reservePct" type="number" min="0" max="90" step="1" value="${strategyPreferences.reservePct}"></label>
          <label>MAX MARKETS<input name="maxMarkets" type="number" min="1" max="8" step="1" value="${strategyPreferences.maxMarkets}"></label>
          <label>MAX PER MARKET · %<input name="maxPerMarketPct" type="number" min="5" max="100" step="1" value="${strategyPreferences.maxPerMarketPct}"></label>
          <label>MIN RESEARCH SCORE<input name="minResearchScore" type="number" min="0" max="100" step="1" value="${strategyPreferences.minResearchScore}"></label>
          <div class="strategy-form-actions"><button type="submit">BUILD PROPOSAL</button><button class="strategy-reset" type="button">RESET</button></div>
        </form>
        <div class="strategy-method"><b>MODEL, NOT FORECAST</b><span>Weights use Opportunity research scores, respect sizing and concentration caps, and preserve the selected reserve. APY uses the current observation and can change.</span></div>
        ${strategyProposal.positions.length ? `<div class="strategy-positions">
          ${strategyProposal.positions.map((position, index) => `<article class="strategy-position">
            <div class="strategy-rank"><span>${String(index + 1).padStart(2, "0")}</span><b>${formatPct(position.portfolioPct, 2)}</b></div>
            <div class="strategy-copy"><h3>${h(position.marketName)}</h3><small>ID ${h(shortId(position.marketId))}</small><p>Opportunity score ${position.researchScore} · Scout ${h(position.scoutStatus)}</p></div>
            <div class="strategy-numbers"><div><span>MODELED AMOUNT</span><b>${formatMoney(position.amountUsd)}</b></div><div><span>OBSERVED APY</span><b>${formatPct(position.observedSupplyApyPct, 3)}</b></div><div><span>ANNUALIZED AT OBSERVED RATE</span><b>${formatMoney(position.annualizedObservedYieldUsd)}</b></div></div>
            <details class="strategy-exits"><summary>REVIEW / EXIT CONDITIONS</summary>${position.exitConditions.map((condition) => `<p>${h(condition)}</p>`).join("")}</details>
            <button class="strategy-open-market" type="button" data-id="${h(position.selectedMarketId)}">INSPECT MARKET →</button>
          </article>`).join("")}
        </div>` : `<div class="strategy-empty"><b>NO ELIGIBLE ALLOCATION</b><p>No Opportunity candidate clears the current Strategy bounds. Lowering a limit changes the model only; it does not make a market safer.</p></div>`}
        <div class="strategy-total">
          <div><span>MODELED OBSERVED ANNUALIZED YIELD</span><b>${formatMoney(strategyProposal.summary.observedAnnualizedYieldUsd)}</b><small>Arithmetic at current observed rates; not predicted or guaranteed.</small></div>
          <div><span>UNALLOCATED AFTER CAPS</span><b>${formatMoney(strategyProposal.summary.unallocatedUsd)}</b><small>Kept outside proposed positions in addition to the explicit reserve.</small></div>
        </div>
        <footer><span>${h(strategyProposal.status.replaceAll("_", " "))} · ${strategyReceipt.receiptId}</span><span>Research proposal only · Human decision required · No transaction</span></footer>
      </section>

      <section class="dex-agent suite-view ${activeSuiteView === "dex" ? "is-active" : ""}" data-suite-view="dex" id="dex-agent" aria-labelledby="dex-title">
        <div class="dex-head">
          <div><p class="eyebrow">DEX POOL SCANNER · USER WATCHLIST</p><h2 id="dex-title">Find the pools people actually trade. ${infoTip("Discovers indexed Arc pools for token contracts selected by the user, then applies pool-specific screening. Selection never means endorsement.")}</h2><p>Inspect liquidity, activity, volatility, pool age and modeled trade size without confusing LP metrics with lending APY.</p></div>
          <div class="dex-actions">${dexReports.length ? `<button class="dex-download" type="button">DOWNLOAD DEX RECEIPT</button>` : ""}<button class="dex-refresh" type="button" ${dexState.mode === "loading" || !dexWatchlist.length ? "disabled" : ""}>${dexState.mode === "loading" ? "SCANNING…" : "SCAN WATCHLIST"}</button></div>
        </div>
        <div class="dex-status ${h(dexState.mode)}"><b>${dexState.mode === "ready" ? `${dexReports.length} ARC POOL${dexReports.length === 1 ? "" : "S"} FOUND` : dexState.mode === "error" ? "SCAN NEEDS ATTENTION" : dexState.mode === "loading" ? "DISCOVERING POOLS" : "WATCHLIST READY"}</b><span>${h(dexState.message)}</span></div>
        <form class="dex-watch-form">
          <label>TOKEN CONTRACT ON ARC<input name="address" type="text" inputmode="text" placeholder="0x…" required></label>
          <label>LABEL<input name="label" type="text" maxlength="48" placeholder="Token name or ticker"></label>
          <label class="dex-speculative"><input name="speculativeApproval" type="checkbox"> INCLUDE AS USER-APPROVED SPECULATIVE</label>
          <button type="submit">ADD & SCAN</button>
        </form>
        <div class="dex-controls">
          <label>MODELED SWAP · USD<input class="dex-swap-amount" type="number" min="1" step="1" value="${dexModeledSwapUsd}"></label>
          <label>QUOTE SLIPPAGE · %<input class="dex-slippage" type="number" min="0.01" max="50" step="0.01" value="${dexSlippageTolerancePct}"></label>
          <p><b>SCREENING RATIO, NOT EXECUTABLE QUOTE.</b> The current model compares trade size with reported liquidity. A later Uniswap quote will add route-specific output, fees and price impact.</p>
        </div>
        <div class="dex-watchlist">
          ${dexWatchlist.length ? dexWatchlist.map((item) => `<div><span>${h(item.label)}</span><code>${h(shortId(item.address))}</code><b class="${item.speculativeApproval ? "speculative" : "standard"}">${item.speculativeApproval ? "SPECULATIVE APPROVED" : "STANDARD RESEARCH"}</b><button class="dex-remove" data-address="${h(item.address)}" type="button">REMOVE</button></div>`).join("") : `<p>No token contracts added. Contract identity is required to avoid selecting an imitation by ticker.</p>`}
        </div>
        <div class="dex-results">
          ${dexReports.length ? dexReports.map((report, index) => `<article class="dex-pool ${report.status.toLowerCase()}">
            <div class="dex-rank"><span>${String(index + 1).padStart(2, "0")}</span><b>${h(report.status)} · ${report.score}</b></div>
            <div class="dex-pair"><h3>${h(report.pool.baseToken.symbol)} / ${h(report.pool.quoteToken.symbol)}</h3><small>${h(report.pool.dexId.toUpperCase())} · ${h(shortId(report.pool.pairAddress))}</small><p>${h(report.firstAttention)}</p></div>
            <div class="dex-metrics"><div><span>LIQUIDITY</span><b>${formatMoney(report.pool.liquidityUsd)}</b></div><div><span>VOLUME 24H</span><b>${formatMoney(report.pool.volume24hUsd)}</b></div><div><span>PRICE CHANGE 24H</span><b>${formatPct(report.pool.priceChange24hPct, 2)}</b></div><div><span>MODELED LIQUIDITY RATIO</span><b>${formatPct(report.modeledLiquidityImpactPct, 3)}</b></div></div>
            <div class="dex-flags"><b>${h(report.label)}</b><span>${report.pool.poolAgeHours === null ? "AGE UNAVAILABLE" : `${Math.floor(report.pool.poolAgeHours)}H OLD`} · ${report.pool.buys24h ?? "?"} BUYS / ${report.pool.sells24h ?? "?"} SELLS</span></div>
            <div class="dex-pool-actions"><button class="dex-quote" type="button" data-pair="${h(report.pool.pairAddress)}" data-token="${h(report.pool.baseToken.address === ARC_USDC ? report.pool.quoteToken.address : report.pool.baseToken.address)}">${dexQuotes[report.pool.pairAddress]?.state === "loading" ? "QUOTING…" : "GET UNISWAP QUOTE"}</button>${report.pool.pairUrl ? `<a href="${h(safeExternalUrl(report.pool.pairUrl))}" target="_blank" rel="noreferrer">OPEN POOL ↗</a>` : ""}</div>
            ${dexQuotes[report.pool.pairAddress] ? `<div class="dex-quote-result ${h(dexQuotes[report.pool.pairAddress].state)}">${dexQuotes[report.pool.pairAddress].state === "ready" ? `<b>OFFICIAL UNISWAP QUOTE · ${h(dexQuotes[report.pool.pairAddress].quote.routing)}</b><span>${formatMoney(dexModeledSwapUsd)} USDC → ${dexQuotes[report.pool.pairAddress].quote.outputAmount === null ? `${h(dexQuotes[report.pool.pairAddress].quote.outputRaw)} base units` : `${dexQuotes[report.pool.pairAddress].quote.outputAmount.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${h(report.pool.baseToken.address === ARC_USDC ? report.pool.quoteToken.symbol : report.pool.baseToken.symbol)}`}</span><small>Slippage ${formatPct(dexQuotes[report.pool.pairAddress].quote.slippageTolerancePct, 2)} · Gas estimate ${formatMoney(dexQuotes[report.pool.pairAddress].quote.gasEstimateUsd)} · ${dexQuotes[report.pool.pairAddress].quote.simulated ? "Route simulation returned without a failure reason" : h(dexQuotes[report.pool.pairAddress].quote.failureReason)}</small>` : dexQuotes[report.pool.pairAddress].state === "error" ? `<b>QUOTE UNAVAILABLE</b><span>${h(dexQuotes[report.pool.pairAddress].error)}</span>` : `<b>REQUESTING OFFICIAL ROUTE…</b>`}</div>` : ""}
          </article>`).join("") : `<div class="dex-empty"><b>NO POOL OBSERVATIONS YET</b><p>Add a token contract or scan the saved watchlist. If an indexer has no Arc pair, Scout will not invent one.</p></div>`}
        </div>
        <section class="dex-opportunity" aria-labelledby="dex-opportunity-title">
          <div class="dex-subhead"><div><p class="eyebrow">DEX OPPORTUNITY AGENT</p><h3 id="dex-opportunity-title">Prioritize pools within your limits. ${infoTip("Turns pool observations into a bounded research queue. REVIEW warnings remain visible and user speculative approval never makes a pool safe.")}</h3></div><div class="dex-subactions">${dexOpportunityAnalysis.candidates.length ? `<button class="dex-opportunity-download" type="button">DOWNLOAD RECEIPT</button>` : ""}<div class="dex-summary"><b>${dexOpportunityAnalysis.summary.eligible}</b><span>ELIGIBLE OF ${dexOpportunityAnalysis.summary.total}</span></div></div></div>
          <form class="dex-opportunity-form">
            <label>MIN POOL SCORE<input name="minPoolScore" type="number" min="0" max="100" step="1" value="${dexOpportunityPreferences.minPoolScore}"></label>
            <label>MIN LIQUIDITY · USD<input name="minLiquidityUsd" type="number" min="0" step="1000" value="${dexOpportunityPreferences.minLiquidityUsd}"></label>
            <label>MIN VOLUME 24H · USD<input name="minVolume24hUsd" type="number" min="0" step="100" value="${dexOpportunityPreferences.minVolume24hUsd}"></label>
            <label>MAX 24H MOVE · %<input name="maxAbsPriceChange24hPct" type="number" min="0" step="1" value="${dexOpportunityPreferences.maxAbsPriceChange24hPct}"></label>
            <label>MAX MODELED IMPACT · %<input name="maxModeledImpactPct" type="number" min="0.01" max="100" step="0.01" value="${dexOpportunityPreferences.maxModeledImpactPct}"></label>
            <label class="dex-checkbox"><input name="includeReview" type="checkbox" ${dexOpportunityPreferences.includeReview ? "checked" : ""}> INCLUDE REVIEW POOLS</label>
            <button type="submit">APPLY DEX LIMITS</button>
          </form>
          <div class="dex-candidates">
            ${dexOpportunityAnalysis.candidates.length ? dexOpportunityAnalysis.candidates.map((candidate, index) => `<article class="${candidate.eligible ? "eligible" : "blocked"}"><span>${String(index + 1).padStart(2, "0")}</span><div><h4>${h(candidate.pairName)}</h4><small>${h(shortId(candidate.pairAddress))} · ${candidate.officialQuoteAvailable ? "OFFICIAL QUOTE AVAILABLE" : "QUOTE NOT REQUESTED"}</small><p>${h(candidate.reason)}</p>${candidate.warnings.length ? `<em>${candidate.warnings.length} warning${candidate.warnings.length === 1 ? "" : "s"} preserved</em>` : ""}</div><b>${candidate.eligible ? "RESEARCH" : "BLOCKED"} · ${candidate.opportunityScore}</b></article>`).join("") : `<p class="dex-subempty">Scan at least one pool to create the DEX research queue.</p>`}
          </div>
        </section>
        <section class="dex-strategy" aria-labelledby="dex-strategy-title">
          <div class="dex-subhead"><div><p class="eyebrow">DEX STRATEGY LAB · NO EXECUTION</p><h3 id="dex-strategy-title">Model a bounded ${dexStrategyProposal.mode === "LP" ? "LP research" : "swap research"} proposal. ${infoTip("Allocates only among pools that clear DEX Opportunity limits. It does not connect a wallet, sign, approve tokens or send a transaction.")}</h3></div><div class="dex-subactions">${dexStrategyProposal.positions.length ? `<button class="dex-strategy-download" type="button">DOWNLOAD RECEIPT</button>` : ""}<div class="dex-summary"><b>${formatMoney(dexStrategyProposal.summary.allocatedUsd)}</b><span>MODELED ALLOCATION</span></div></div></div>
          <form class="dex-strategy-form">
            <label>RESEARCH MODE<select name="mode"><option value="SWAP" ${dexStrategyPreferences.mode === "SWAP" ? "selected" : ""}>Swap research</option><option value="LP" ${dexStrategyPreferences.mode === "LP" ? "selected" : ""}>LP research</option></select></label>
            <label>MODELED CAPITAL · USD<input name="capitalUsd" type="number" min="1" step="100" value="${dexStrategyPreferences.capitalUsd}"></label>
            <label>RESERVE · %<input name="reservePct" type="number" min="0" max="90" step="1" value="${dexStrategyPreferences.reservePct}"></label>
            <label>MAX POOLS<input name="maxPools" type="number" min="1" max="8" step="1" value="${dexStrategyPreferences.maxPools}"></label>
            <label>MAX PER POOL · %<input name="maxPerPoolPct" type="number" min="5" max="100" step="1" value="${dexStrategyPreferences.maxPerPoolPct}"></label>
            <button type="submit">BUILD PROPOSAL</button>
          </form>
          <div class="dex-strategy-notice"><b>${h(dexStrategyProposal.status.replaceAll("_", " "))}</b><span>${h(dexStrategyProposal.notice)}</span></div>
          ${dexStrategyProposal.positions.length ? `<div class="dex-strategy-positions">${dexStrategyProposal.positions.map((position, index) => `<article><div><span>${String(index + 1).padStart(2, "0")}</span><h4>${h(position.pairName)}</h4><small>Opportunity ${position.opportunityScore} · ${formatPct(position.portfolioPct, 2)} of modeled capital</small></div><strong>${formatMoney(position.amountUsd)}</strong><p>${h(position.riskConditions[0])}</p>${dexStrategyProposal.mode === "SWAP" ? `<em>${position.officialQuoteAvailable ? "Official route evidence attached; re-quote required before action." : "No official route attached; request a quote in Pool Scanner."}</em>` : `<em>Verified fee yield unavailable; no APY is claimed.</em>`}</article>`).join("")}</div>` : `<p class="dex-subempty">No pool clears the active DEX limits, so the model allocates nothing.</p>`}
          ${dexStrategyProposal.impermanentLossReferencePct ? `<div class="dex-il"><b>REFERENCE IMPERMANENT LOSS · FULL-RANGE CONSTANT PRODUCT · FEES EXCLUDED</b><div><span>PRICE 0.5× <strong>${formatPct(dexStrategyProposal.impermanentLossReferencePct.priceDown50Pct, 2)}</strong></span><span>PRICE 2× <strong>${formatPct(dexStrategyProposal.impermanentLossReferencePct.priceUp100Pct, 2)}</strong></span><span>PRICE 4× <strong>${formatPct(dexStrategyProposal.impermanentLossReferencePct.priceUp300Pct, 2)}</strong></span></div></div>` : ""}
          <div class="dex-strategy-totals"><span>CAPITAL ${formatMoney(dexStrategyProposal.summary.capitalUsd)}</span><span>RESERVE ${formatMoney(dexStrategyProposal.summary.reserveUsd)}</span><span>UNALLOCATED ${formatMoney(dexStrategyProposal.summary.unallocatedUsd)}</span></div>
        </section>
        <footer><span>LENDING AND DEX EVIDENCE REMAIN SEPARATE</span><span>User selection does not override REVIEW or REJECT</span></footer>
      </section>

      <section class="action-center suite-view ${activeSuiteView === "action" ? "is-active" : ""}" data-suite-view="action" id="action-agent" aria-labelledby="action-title">
        <div class="action-head">
          <div><p class="eyebrow">ACTION CENTER · HUMAN GATE</p><h2 id="action-title">Understand the action before authorization. ${infoTip("Converts one modeled Strategy position into an auditable intent and checks what evidence is present or still missing. It does not create an executable transaction.")}</h2><p>Research becomes an explicit intent here. Wallet connection, token approval, calldata, signature and transaction submission remain unavailable.</p></div>
          ${actionReceipt ? `<button class="action-download" type="button">DOWNLOAD ACTION RECEIPT</button>` : ""}
        </div>
        <form class="action-builder">
          <label>MODELED POSITION<select name="choice" ${actionChoices.length ? "" : "disabled"}>${actionChoices.length ? actionChoices.map((item) => `<option value="${h(item.key)}">${h(item.label)}</option>`).join("") : `<option>No eligible Strategy position</option>`}</select></label>
          <button type="submit" ${actionChoices.length ? "" : "disabled"}>CREATE READ-ONLY PREVIEW</button>
        </form>
        <div class="action-status ${actionPreview ? actionPreview.status.toLowerCase() : "idle"}"><b>${actionPreview ? h(actionPreview.status.replaceAll("_", " ")) : "NO ACTIVE INTENT"}</b><span>${h(actionMessage)}</span></div>
        ${actionPreview ? `<div class="action-preview">
          <div class="action-intent"><div><span>INTENT</span><b>${h(actionPreview.intent.kind.replaceAll("_", " "))}</b></div><div><span>TARGET</span><b>${h(actionPreview.target.name)}</b><small>${h(shortId(actionPreview.target.id))}</small></div><div><span>MODELED AMOUNT</span><b>${formatMoney(actionPreview.intent.amountUsd)}</b></div><div><span>NETWORK</span><b>${h(actionPreview.network)} · ${actionPreview.chainId}</b></div></div>
          <div class="action-checks">${actionPreview.checks.map((item) => `<article class="${h(item.outcome)}"><span>${item.outcome === "pass" ? "✓" : item.outcome === "block" ? "×" : "!"}</span><div><b>${h(item.label)}</b><small>${h(item.detail)}</small></div></article>`).join("")}</div>
          <details class="action-missing" open><summary>REQUIRED BEFORE ANY REAL EXECUTION</summary>${actionPreview.missingBeforeExecution.map((item) => `<p>${h(item)}</p>`).join("")}</details>
          ${actionPreview.status !== "BLOCKED" && !actionApproval ? `<form class="action-approval-form">
            <div><label>OPERATOR NAME<input name="operator" type="text" minlength="2" maxlength="80" required></label><label>OPTIONAL REVIEW NOTE<textarea name="note" maxlength="500" rows="2"></textarea></label></div>
            <div class="action-confirmations"><p>One approval confirms that this preview does not execute, that the visible warnings were presented, and that a fresh simulation is required before any future signature.</p><label><input name="informedApproval" type="checkbox" required> I understand and approve this intent for manual preparation only.</label></div>
            <button type="submit">APPROVE FOR MANUAL PREPARATION ONLY</button>
          </form>` : actionApproval ? `<div class="action-approved"><b>HUMAN GATE RECORDED</b><span>${h(actionApproval.operator)} · ${h(actionApproval.decision.replaceAll("_", " "))}</span><small>Expires ${h(new Date(actionApproval.expiresAt).toLocaleString())}. This is not a wallet signature.</small></div>` : `<div class="action-blocked"><b>PREVIEW BLOCKED</b><span>Correct every blocking identity or evidence check before requesting human approval.</span></div>`}
        </div>` : `<div class="action-empty"><b>NO TRANSACTION IS IMPLIED</b><p>Choose a position produced by Strategy Lab. Action Center will preserve its source receipt and expose the remaining authorization boundary.</p></div>`}
        <footer><span>${actionReceipt ? h(actionReceipt.receiptId) : "NO ACTION RECEIPT YET"}</span><span>Prepared: NO · Signed: NO · Submitted: NO</span></footer>
      </section>

      <section class="guardian-agent suite-view ${activeSuiteView === "guardian" ? "is-active" : ""}" data-suite-view="guardian" id="guardian-agent" aria-labelledby="guardian-title">
        <div class="guardian-head"><div><p class="eyebrow">GUARDIAN · RESEARCH MONITOR</p><h2 id="guardian-title">Watch the approved intent, not imaginary funds. ${infoTip("Guardian records a baseline for the Action Center intent and compares later evidence. Until execution exists, it never calls this a funded position.")}</h2><p>Detect deteriorating liquidity, utilization, price movement, modeled impact or policy status and route any response back through human review.</p></div><div class="guardian-actions">${guardianReceipt ? `<button class="guardian-download" type="button">DOWNLOAD RECEIPT</button>` : ""}${actionApproval && !guardianWatch ? `<button class="guardian-start" type="button" ${currentGuardianEvidence ? "" : "disabled"}>START WATCH</button>` : guardianWatch ? `<button class="guardian-check" type="button">CHECK FRESH EVIDENCE</button>` : ""}</div></div>
        ${!actionApproval ? `<div class="guardian-empty"><b>WAITING FOR AN APPROVED INTENT</b><p>Create and approve an Action Center preview once. Guardian cannot invent a target or monitor an unapproved proposal.</p></div>` : !guardianWatch ? `<div class="guardian-ready"><b>BASELINE READY</b><span>${currentGuardianEvidence ? `Current evidence found for ${h(actionPreview.target.name)}.` : "The selected target is not present in the current data."}</span></div>` : `<div class="guardian-body">
          <div class="guardian-verdict ${guardianObservation.decision.toLowerCase()}"><div><span>CURRENT DECISION</span><b>${h(guardianObservation.decision.replaceAll("_", " "))}</b><small>${guardianObservation.requiresHumanAttention ? "Human attention required" : "Inside recorded limits"}</small></div><div><span>WATCHED INTENT</span><b>${h(guardianWatch.intent.kind.replaceAll("_", " "))}</b><small>${h(guardianWatch.target.name)} · ${formatMoney(guardianWatch.intent.amountUsd)}</small></div><div><span>BASELINE</span><b>${h(new Date(guardianWatch.createdAt).toLocaleString())}</b><small>${h(shortId(guardianWatch.target.id))}</small></div></div>
          <div class="guardian-reasons">${guardianObservation.reasons.map((reason) => `<p>${h(reason)}</p>`).join("")}</div>
          <div class="guardian-comparison"><div><span>BASELINE LIQUIDITY</span><b>${formatMoney(guardianWatch.baseline.liquidityUsd)}</b></div><div><span>CURRENT LIQUIDITY</span><b>${formatMoney(guardianObservation.current?.liquidityUsd)}</b></div><div><span>BASELINE STATUS</span><b>${h(guardianWatch.baseline.status)}</b></div><div><span>CURRENT STATUS</span><b>${h(guardianObservation.current?.status ?? "MISSING")}</b></div></div>
          <div class="guardian-boundary"><b>NO AUTOMATED EXIT</b><span>Guardian can propose attention or stopping research. Any future rebalance, withdrawal or swap must create a new Action Center intent.</span></div>
        </div>`}
        <footer><span>${guardianReceipt ? h(guardianReceipt.receiptId) : "NO GUARDIAN RECEIPT YET"}</span><span>Automated action: NO · Transaction: NONE</span></footer>
      </section>

      <section class="automation-agent suite-view ${activeSuiteView === "automation" ? "is-active" : ""}" data-suite-view="automation" id="automation-agent" aria-labelledby="automation-title">
        <div class="automation-head"><div><p class="eyebrow">AUTOMATION · PERMISSION SANDBOX</p><h2 id="automation-title">Prove the limits before installing permissions. ${infoTip("Models an exact-target, exact-intent, capped and expiring permission. Nothing is installed in a wallet, smart account or contract.")}</h2><p>Test whether a hypothetical request would clear every allowlist, cap, expiry, Guardian and human-approval gate.</p></div>${automationReceipt ? `<button class="automation-download" type="button">DOWNLOAD RECEIPT</button>` : ""}</div>
        ${!guardianWatch ? `<div class="automation-empty"><b>WAITING FOR GUARDIAN</b><p>Automation cannot define permissions until an approved intent has a Guardian baseline.</p></div>` : !automationPolicy ? `<form class="automation-policy-form">
          <div><span>INHERITED TARGET</span><b>${h(guardianWatch.target.name)}</b><small>${h(shortId(guardianWatch.target.id))} · ${h(guardianWatch.intent.kind.replaceAll("_", " "))}</small></div>
          <label>MAX PER ACTION · USD<input name="perActionCapUsd" type="number" min="1" max="${guardianWatch.intent.amountUsd}" step="1" value="${Math.min(guardianWatch.intent.amountUsd, 500)}"></label>
          <label>MAX PER DAY · USD<input name="dailyCapUsd" type="number" min="1" step="1" value="${guardianWatch.intent.amountUsd}"></label>
          <label>DURATION · MINUTES<input name="durationMinutes" type="number" min="5" max="1440" step="5" value="60"></label>
          <button type="submit">CREATE SIMULATED POLICY</button>
        </form>` : `<div class="automation-body">
          <div class="automation-policy-state ${automationPolicy.state.toLowerCase()}"><div><span>POLICY STATE</span><b>${h(automationPolicy.state.replaceAll("_", " "))}</b></div><div><span>PER ACTION CAP</span><b>${formatMoney(automationPolicy.perActionCapUsd)}</b></div><div><span>DAILY CAP</span><b>${formatMoney(automationPolicy.dailyCapUsd)}</b></div><div><span>EXPIRES</span><b>${h(new Date(automationPolicy.expiresAt).toLocaleString())}</b></div></div>
          <div class="automation-rules"><p>Exact target: <b>${h(shortId(automationPolicy.allowlistedTargets[0]))}</b></p><p>Allowed intent: <b>${h(automationPolicy.allowedIntents[0].replaceAll("_", " "))}</b></p><p>Guardian required: <b>${h(automationPolicy.requireGuardianDecision.replaceAll("_", " "))}</b></p><p>Fresh human gate: <b>REQUIRED</b></p></div>
          <form class="automation-evaluation-form"><label>HYPOTHETICAL REQUEST · USD<input name="amountUsd" type="number" min="1" step="1" value="${Math.min(automationPolicy.perActionCapUsd, guardianWatch.intent.amountUsd)}"></label><label>ALREADY MODELED TODAY · USD<input name="spentTodayUsd" type="number" min="0" step="1" value="0"></label><button type="submit">TEST REQUEST</button></form>
          ${automationEvaluation ? `<div class="automation-result ${automationEvaluation.decision.toLowerCase()}"><div><span>SIMULATED DECISION</span><b>${h(automationEvaluation.decision.replaceAll("_", " "))}</b><small>No execution attempted</small></div><div class="automation-checks">${automationEvaluation.checks.map((item) => `<p class="${h(item.outcome)}"><b>${item.outcome === "pass" ? "✓" : "×"} ${h(item.id.toUpperCase())}</b><span>${h(item.detail)}</span></p>`).join("")}</div></div>` : `<div class="automation-prompt">Enter a hypothetical amount to test all gates. A green result still does not authorize execution.</div>`}
          <div class="automation-controls"><button class="automation-pause" type="button" ${automationPolicy.state !== "ACTIVE_SIMULATION" ? "disabled" : ""}>EMERGENCY PAUSE</button><button class="automation-revoke" type="button" ${automationPolicy.state === "REVOKED" ? "disabled" : ""}>REVOKE POLICY</button></div>
        </div>`}
        <footer><span>${automationReceipt ? h(automationReceipt.receiptId) : "NO AUTOMATION RECEIPT YET"}</span><span>Installed: NO · Key access: NONE · Execution: NONE</span></footer>
      </section>

      <section class="workspace suite-view ${activeSuiteView === "scout" ? "is-active" : ""}" data-suite-view="scout">
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

  document.querySelector(".suite-home")?.addEventListener("click", (event) => { event.preventDefault(); openSuiteView("hub"); });
  document.querySelectorAll(".suite-tab").forEach((button) => button.addEventListener("click", () => openSuiteView(button.dataset.view)));
  document.querySelectorAll(".market-button").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    render();
  }));
  document.querySelectorAll(".hub-open-agent").forEach((button) => button.addEventListener("click", () => openSuiteView(button.dataset.target.replace("-agent", ""))));
  document.querySelector(".opportunity-preferences")?.addEventListener("submit", (event) => {
    event.preventDefault();
    opportunityPreferences = saveOpportunityPreferences(window.localStorage, Object.fromEntries(new FormData(event.currentTarget)));
    render();
  });
  document.querySelector(".opportunity-reset")?.addEventListener("click", () => {
    opportunityPreferences = saveOpportunityPreferences(window.localStorage, defaultOpportunityPreferences);
    render();
  });
  document.querySelector(".opportunity-download")?.addEventListener("click", () => downloadScoutReceipt(opportunityReceipt));
  document.querySelectorAll(".opportunity-open-market").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    openSuiteView("scout");
  }));
  document.querySelector(".strategy-preferences")?.addEventListener("submit", (event) => {
    event.preventDefault();
    strategyPreferences = saveStrategyPreferences(window.localStorage, Object.fromEntries(new FormData(event.currentTarget)));
    render();
  });
  document.querySelector(".strategy-reset")?.addEventListener("click", () => {
    strategyPreferences = saveStrategyPreferences(window.localStorage, defaultStrategyPreferences);
    render();
  });
  document.querySelector(".strategy-download")?.addEventListener("click", () => downloadScoutReceipt(strategyReceipt));
  document.querySelectorAll(".strategy-open-market").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    openSuiteView("scout");
  }));
  document.querySelector(".dex-watch-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const address = String(values.get("address") ?? "").trim().toLowerCase();
    if (!isEvmAddress(address)) {
      dexState = { mode: "error", message: "Enter a complete 0x EVM token contract address." };
      render();
      return;
    }
    dexWatchlist = saveDexWatchlist(window.localStorage, [...dexWatchlist, { address, label: values.get("label"), speculativeApproval: values.get("speculativeApproval") === "on", addedAt: new Date().toISOString() }]);
    await scanDexWatchlist();
  });
  document.querySelector(".dex-refresh")?.addEventListener("click", () => scanDexWatchlist());
  document.querySelector(".dex-download")?.addEventListener("click", () => downloadScoutReceipt(dexReceipt));
  document.querySelector(".dex-swap-amount")?.addEventListener("change", (event) => {
    dexModeledSwapUsd = Math.max(1, Number(event.target.value) || 1);
    dexQuotes = {};
    render();
  });
  document.querySelector(".dex-slippage")?.addEventListener("change", (event) => {
    dexSlippageTolerancePct = Math.min(50, Math.max(0.01, Number(event.target.value) || 0.5));
    dexQuotes = {};
    render();
  });
  document.querySelectorAll(".dex-quote").forEach((button) => button.addEventListener("click", async () => {
    const pairAddress = button.dataset.pair;
    dexQuotes = { ...dexQuotes, [pairAddress]: { state: "loading" } };
    render();
    try {
      const quote = await requestUniswapQuote({ tokenOut: button.dataset.token, amountUsd: dexModeledSwapUsd, slippageTolerancePct: dexSlippageTolerancePct });
      dexQuotes = { ...dexQuotes, [pairAddress]: { state: "ready", quote } };
    } catch (error) {
      dexQuotes = { ...dexQuotes, [pairAddress]: { state: "error", error: error.message ?? "Official quote unavailable." } };
    }
    render();
  }));
  document.querySelectorAll(".dex-remove").forEach((button) => button.addEventListener("click", () => {
    dexWatchlist = saveDexWatchlist(window.localStorage, dexWatchlist.filter((item) => item.address !== button.dataset.address));
    dexPools = dexPools.filter((pool) => ![pool.baseToken.address, pool.quoteToken.address].includes(button.dataset.address));
    dexQuotes = {};
    dexState = { mode: dexPools.length ? "ready" : "idle", message: dexPools.length ? `${dexPools.length} indexed Arc pools remain after updating the watchlist.` : "Add an Arc token contract to discover its indexed DEX pools." };
    render();
  }));
  document.querySelector(".dex-opportunity-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    dexOpportunityPreferences = saveDexOpportunityPreferences(window.localStorage, Object.fromEntries(new FormData(event.currentTarget)));
    render();
  });
  document.querySelector(".dex-strategy-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    dexStrategyPreferences = saveDexStrategyPreferences(window.localStorage, Object.fromEntries(new FormData(event.currentTarget)));
    render();
  });
  document.querySelector(".dex-opportunity-download")?.addEventListener("click", () => downloadScoutReceipt(dexOpportunityReceipt));
  document.querySelector(".dex-strategy-download")?.addEventListener("click", () => downloadScoutReceipt(dexStrategyReceipt));
  document.querySelector(".action-builder")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const choice = actionChoices.find((item) => item.key === new FormData(event.currentTarget).get("choice"));
    if (!choice) return;
    actionPreview = createActionPreview({ source: choice.source, position: choice.position, sourceReceiptId: choice.receiptId });
    actionApproval = null;
    guardianWatch = null;
    guardianObservation = null;
    automationPolicy = null;
    automationEvaluation = null;
    actionMessage = `Preview created from ${choice.receiptId}. Review every check before recording the human gate.`;
    render();
    document.querySelector(".action-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector(".action-approval-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      actionApproval = createActionApproval({ preview: actionPreview, operator: values.get("operator"), note: values.get("note"), informedApproval: values.get("informedApproval") });
      actionMessage = "Human review recorded for manual preparation only; no wallet authorization exists.";
    } catch (error) { actionMessage = error.message; }
    render();
  });
  document.querySelector(".action-download")?.addEventListener("click", () => downloadScoutReceipt(actionReceipt));
  document.querySelector(".guardian-start")?.addEventListener("click", () => {
    guardianWatch = createGuardianWatch({ preview: actionPreview, approval: actionApproval, evidence: currentGuardianEvidence });
    guardianObservation = evaluateGuardian(guardianWatch, currentGuardianEvidence);
    render();
  });
  document.querySelector(".guardian-check")?.addEventListener("click", async () => {
    if (actionPreview.source === "LENDING") await refreshMarkets(); else await scanDexWatchlist();
    let evidence = null;
    if (actionPreview.source === "LENDING") {
      const watchedMarket = markets.find((item) => item.marketId?.toLowerCase() === actionPreview.target.id?.toLowerCase());
      if (watchedMarket) evidence = guardianEvidenceFromLending(watchedMarket, evaluateMarket(watchedMarket, activePolicy));
    } else {
      const reports = dexPools.map((pool) => evaluateDexPool(pool, undefined, dexModeledSwapUsd));
      evidence = guardianEvidenceFromDex(reports.find((item) => item.pool.pairAddress?.toLowerCase() === actionPreview.target.id?.toLowerCase()));
    }
    guardianObservation = evaluateGuardian(guardianWatch, evidence);
    render();
  });
  document.querySelector(".guardian-download")?.addEventListener("click", () => downloadScoutReceipt(guardianReceipt));
  document.querySelector(".automation-policy-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    automationPolicy = createPermissionPolicy({ watch: guardianWatch, ...values });
    automationEvaluation = null;
    render();
  });
  document.querySelector(".automation-evaluation-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const approvalFresh = Boolean(actionApproval && Date.now() <= new Date(actionApproval.expiresAt).getTime());
    automationEvaluation = evaluatePermissionRequest({ policy: automationPolicy, targetId: guardianWatch.target.id, intentKind: guardianWatch.intent.kind, amountUsd: values.amountUsd, spentTodayUsd: values.spentTodayUsd, guardianDecision: guardianObservation?.decision, humanApprovalFresh: approvalFresh });
    render();
  });
  document.querySelector(".automation-pause")?.addEventListener("click", () => { automationPolicy = pausePermissionPolicy(automationPolicy); automationEvaluation = null; render(); });
  document.querySelector(".automation-revoke")?.addEventListener("click", () => { automationPolicy = revokePermissionPolicy(automationPolicy); automationEvaluation = null; render(); });
  document.querySelector(".automation-download")?.addEventListener("click", () => downloadScoutReceipt(automationReceipt));
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

async function scanDexWatchlist() {
  if (!dexWatchlist.length) return;
  dexState = { mode: "loading", message: `Checking indexed Arc pools for ${dexWatchlist.length} selected token${dexWatchlist.length === 1 ? "" : "s"}…` };
  dexQuotes = {};
  render();
  try {
    const results = await Promise.allSettled(dexWatchlist.map((item) => fetchArcPoolsForToken(item.address, item)));
    const unique = new Map();
    for (const result of results) if (result.status === "fulfilled") for (const pool of result.value) unique.set(pool.pairAddress, pool);
    dexPools = [...unique.values()];
    const failures = results.filter((result) => result.status === "rejected").length;
    dexState = {
      mode: failures === results.length ? "error" : "ready",
      message: failures === results.length ? "Every DEX index request failed; no pool data was accepted." : `${dexPools.length} indexed Arc pool${dexPools.length === 1 ? "" : "s"} found.${failures ? ` ${failures} token request${failures === 1 ? "" : "s"} failed safely.` : ""}`
    };
  } catch (error) {
    dexPools = [];
    dexState = { mode: "error", message: error.message ?? "DEX pool discovery failed safely." };
  }
  render();
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
