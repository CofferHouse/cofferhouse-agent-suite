import "./styles.css";
import { demoMarkets, fetchMorphoArcMarkets } from "../../../packages/arc-data/index.js";
import { evaluateMarket, loadAlertLimits, policyProfiles, saveAlertLimits } from "../../../packages/policies/index.js";
import { addResearchSessionReceipt, clearOperatorWorkspace, clearResearchSessionHistory, compareResearchSessions, createActionReceipt, createAutomationReceipt, createBorrowPreviewReceipt, createDexOpportunityReceipt, createDexReceipt, createDexStrategyReceipt, createEarnOpportunityReceipt, createEarnStrategyReceipt, createGuardianReceipt, createInteropReceipt, createOpportunityReceipt, createResearchSessionReceipt, createScoutReceipt, createSimulationReceipt, createStrategyReceipt, downloadScoutReceipt, loadOperatorWorkspace, loadResearchSessionHistory, researchSessionFromReceipt, saveOperatorWorkspace, saveResearchSessionHistory, verifyReceiptDocument } from "../../../packages/evidence/index.js";
import { addMonitorObservation, clearMonitorHistory, escapeHtml as h, loadMonitorHistory, safeExternalUrl, saveMonitorHistory } from "../../../packages/shared/index.js";
import { SERVER_STATUS_REFRESH_MS, advanceAgentState, agentCatalog, agentDecision, buildMissionControl, compareMarketSnapshots, createAgentRuntimeState, runtimeConnectionLabel, scanMarkets, shouldRefreshRuntimeStatus } from "../../../packages/agent-core/index.js";
import { ARC_CCTP_CONTRACTS, ARC_USDC, analyzeDexOpportunities, analyzeEarnOpportunities, analyzeOpportunities, arcAppKitCatalog, buildDexStrategy, buildEarnStrategy, buildStrategy, createActionApproval, createActionPreview, createGuardianWatch, createPermissionPolicy, defaultEarnOpportunityPreferences, defaultOpportunityPreferences, defaultStrategyPreferences, disconnectedHolderIdentity, evaluateDexPool, evaluateGuardian, evaluatePermissionRequest, fetchArcBorrowMarkets, fetchArcEarnVaults, fetchArcPoolsForToken, fetchOnrampReadiness, guardianEvidenceFromDex, guardianEvidenceFromLending, holderAccess, holderLevels, interopCapabilityRegistry, isActionApprovalFresh, isEvmAddress, loadDexOpportunityPreferences, loadDexStrategyPreferences, loadDexWatchlist, loadEarnOpportunityPreferences, loadHolderPreferences, loadOpportunityPreferences, loadStrategyPreferences, nextAscension, pausePermissionPolicy, readHolderIdentity, requestBorrowPreview, requestOnrampSession, requestUniswapQuote, revokePermissionPolicy, rewardModes, runResearchSession, saveDexOpportunityPreferences, saveDexStrategyPreferences, saveDexWatchlist, saveEarnOpportunityPreferences, saveHolderPreferences, saveOpportunityPreferences, saveStrategyPreferences, simulateBorrow, suggestedBorrowAmount } from "../../../packages/agent-modules/index.js";
import { productLinks } from "../../../packages/product-config/index.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const formatMoney = (value) => value === null || value === undefined ? "Unavailable" : money.format(value);
const formatPct = (value, digits = 1) => value === null || value === undefined ? "Unavailable" : `${value.toFixed(digits)}%`;
const shortId = (value) => value && value.startsWith("0x") && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value || "Unavailable";
const explorerAddress = (address) => address ? `https://arc.etherscan.io/address/${address}` : null;
const infoTip = (text) => `<span class="info-tip" tabindex="0" role="note" aria-label="${h(text)}">i<span class="info-card">${h(text)}</span></span>`;
const identityValue = (label, value, url = null) => `<div><span>${h(label)}</span>${url ? `<a href="${h(safeExternalUrl(url))}" target="_blank" rel="noreferrer" title="${h(value)}">${h(shortId(value))} ↗</a>` : `<b title="${h(value || "")}">${h(shortId(value))}</b>`}</div>`;
const app = document.querySelector("#app");
const PRODUCT_LINKS = productLinks(import.meta.env);
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
let serverRuntime = { mode: "checking", configured: false, access: "public_summary", capabilities: {}, deployment: null, status: null, runState: null, runAttempt: null, failureHistory: [], summaryCounts: null, history: [], acknowledgment: null, acknowledgments: [], researchSession: null, researchSessions: [], guardianRegistration: null, guardian: null, guardianHistory: [], interop: null, interopHistory: [], lastCheckedAt: null, lastError: null };
let serverRuntimeLoading = false;
let serverRuntimeRefreshTimer = null;
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
const restoredOperatorWorkspace = loadOperatorWorkspace(window.localStorage);
let actionPreview = restoredOperatorWorkspace?.actionPreview ?? null;
let actionApproval = restoredOperatorWorkspace?.actionApproval ?? null;
let actionMessage = restoredOperatorWorkspace ? "Verified operator workspace restored from this browser. Freshness gates remain enforced." : "Select a modeled position to create a read-only action preview.";
let guardianWatch = restoredOperatorWorkspace?.guardianWatch ?? null;
let guardianObservation = restoredOperatorWorkspace?.guardianObservation ?? null;
let durableGuardianMessage = "Register a lending watch once to evaluate it during every protected server cycle.";
let automationPolicy = restoredOperatorWorkspace?.automationPolicy ?? null;
let automationEvaluation = restoredOperatorWorkspace?.automationEvaluation ?? null;
let activeSuiteView = "holder";
let holderPreferences = loadHolderPreferences(window.localStorage);
let holderIdentity = disconnectedHolderIdentity(Boolean(window.ethereum));
let holderIdentityBusy = false;
const demoHolderLevel = "member";
let researchSessionHistory = loadResearchSessionHistory(window.localStorage);
let researchSession = researchSessionHistory[0] ? researchSessionFromReceipt(researchSessionHistory[0]) : null;
let interopState = { mode: "idle", message: "Run an observation to inspect recent Arc CCTP V2 activity.", observation: null };
let earnKitState = { mode: "loading", message: "Discovering official Arc Earn vaults…", data: null };
let earnOpportunityPreferences = loadEarnOpportunityPreferences(window.localStorage);
let onrampState = { mode: "checking", message: "Checking protected Onramp readiness…", readiness: null, session: null };
let borrowKitState = { mode: "loading", message: "Discovering official cirBTC/USDC markets…", data: null, preview: null };

function persistOperatorState() {
  saveOperatorWorkspace(window.localStorage, { actionPreview, actionApproval, guardianWatch, guardianObservation, automationPolicy, automationEvaluation });
}

function resetOperatorState(message) {
  actionPreview = null;
  actionApproval = null;
  guardianWatch = null;
  guardianObservation = null;
  automationPolicy = null;
  automationEvaluation = null;
  actionMessage = message;
  clearOperatorWorkspace(window.localStorage);
}

const suiteTabs = Object.freeze([
  { id: "holder", label: "Holder Center", mark: "⌂" },
  { id: "hub", label: "Agent Hub", mark: "00" },
  { id: "scout", label: "Scout", mark: "01" },
  { id: "opportunity", label: "Opportunities", mark: "02" },
  { id: "strategy", label: "Strategy", mark: "03" },
  { id: "dex", label: "DEX", mark: "04" },
  { id: "action", label: "Action Center", mark: "05" },
  { id: "guardian", label: "Guardian", mark: "06" },
  { id: "automation", label: "Automation", mark: "07" },
  { id: "interop", label: "Interop", mark: "08" }
]);

const requestedRoute = window.location.hash;
const requestedSuiteView = requestedRoute.match(/^#agents\/(.+)$/)?.[1];
if (requestedRoute === "#agents") activeSuiteView = "hub";
else if (requestedRoute === "#holders" || requestedRoute === "") activeSuiteView = "holder";
else if (suiteTabs.some((tab) => tab.id === requestedSuiteView)) activeSuiteView = requestedSuiteView;

function openSuiteView(view) {
  if (!suiteTabs.some((tab) => tab.id === view)) return;
  activeSuiteView = view;
  window.history.replaceState(null, "", view === "holder" ? "#holders" : view === "hub" ? "#agents" : `#agents/${view}`);
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
  const earnAnalysis = analyzeEarnOpportunities(earnKitState.data?.vaults ?? [], earnOpportunityPreferences);
  const earnReceipt = earnAnalysis.opportunities.length ? createEarnOpportunityReceipt(earnAnalysis) : null;
  const earnStrategyProposal = buildEarnStrategy(earnAnalysis, strategyPreferences);
  const earnStrategyReceipt = createEarnStrategyReceipt(earnStrategyProposal);
  const dexReports = dexPools.map((pool) => evaluateDexPool(pool, undefined, dexModeledSwapUsd)).sort((a, b) => b.score - a.score || (b.pool.liquidityUsd ?? -1) - (a.pool.liquidityUsd ?? -1));
  const dexReceipt = createDexReceipt(dexReports, dexWatchlist, dexModeledSwapUsd);
  const dexOpportunityAnalysis = analyzeDexOpportunities(dexReports, dexOpportunityPreferences, dexQuotes);
  const dexStrategyProposal = buildDexStrategy(dexOpportunityAnalysis, dexStrategyPreferences);
  const dexOpportunityReceipt = createDexOpportunityReceipt(dexOpportunityAnalysis);
  const dexStrategyReceipt = createDexStrategyReceipt(dexStrategyProposal);
  const researchSessionReceipt = researchSession ? createResearchSessionReceipt(researchSession) : null;
  const selectedSessionIndex = researchSessionReceipt ? researchSessionHistory.findIndex((item) => item.receiptId === researchSessionReceipt.receiptId) : -1;
  const previousSessionReceipt = selectedSessionIndex >= 0 ? researchSessionHistory[selectedSessionIndex + 1] : null;
  const sessionComparison = researchSessionReceipt && previousSessionReceipt ? compareResearchSessions(researchSessionReceipt, previousSessionReceipt) : null;
  const serverResearchVerification = serverRuntime.researchSession ? verifyReceiptDocument(serverRuntime.researchSession) : null;
  const durableGuardianRegistrations = Array.isArray(serverRuntime.guardianRegistration) ? serverRuntime.guardianRegistration : serverRuntime.guardianRegistration ? [serverRuntime.guardianRegistration] : [];
  const durableGuardianReceipts = (Array.isArray(serverRuntime.guardian) ? serverRuntime.guardian : serverRuntime.guardian ? [serverRuntime.guardian] : []).filter((item) => verifyReceiptDocument(item).valid);
  const durableGuardianObservation = durableGuardianReceipts.map((item) => item.observation).find((item) => item.requiresHumanAttention) ?? durableGuardianReceipts[0]?.observation ?? null;
  const serverIncidents = [serverRuntime.status?.alert, ...(serverRuntime.status?.guardian?.alerts ?? []), serverRuntime.status?.guardian?.alert].filter((alert, index, items) => alert?.fingerprint && items.findIndex((item) => item?.fingerprint === alert.fingerprint) === index);
  const acknowledgmentFor = (fingerprint) => serverRuntime.acknowledgments.find((item) => item.fingerprint === fingerprint) ?? (serverRuntime.acknowledgment?.fingerprint === fingerprint ? serverRuntime.acknowledgment : null);
  const actionApprovalFresh = isActionApprovalFresh(actionApproval);
  const activeActionApproval = actionApprovalFresh ? actionApproval : null;
  const missionControl = buildMissionControl({ scan: agentScan, session: researchSession, actionPreview, actionApproval: activeActionApproval, guardianObservation, durableGuardianObservation, automationEvaluation, deployment: serverRuntime.deployment });
  const runtimeConnection = runtimeConnectionLabel(serverRuntime);
  const actionLendingStrategy = researchSession?.outputs.strategy ?? strategyProposal;
  const actionDexStrategy = researchSession?.outputs.dexStrategy ?? dexStrategyProposal;
  const coordinatedReceiptId = researchSessionReceipt?.receiptId;
  const actionChoices = [
    ...actionLendingStrategy.positions.map((position, index) => ({ key: `LENDING:${index}`, source: "LENDING", position, receiptId: coordinatedReceiptId ?? strategyReceipt.receiptId, label: `Lending · ${position.marketName} · ${formatMoney(position.amountUsd)}` })),
    ...actionDexStrategy.positions.map((position, index) => ({ key: `${actionDexStrategy.mode === "LP" ? "DEX_LP" : "DEX_SWAP"}:${index}`, source: actionDexStrategy.mode === "LP" ? "DEX_LP" : "DEX_SWAP", position, receiptId: coordinatedReceiptId ?? dexStrategyReceipt.receiptId, label: `${actionDexStrategy.mode} · ${position.pairName} · ${formatMoney(position.amountUsd)}` }))
  ];
  const actionReceipt = actionPreview ? createActionReceipt(actionPreview, actionApproval) : null;
  const borrowPreviewReceipt = borrowKitState.preview ? createBorrowPreviewReceipt(borrowKitState.preview) : null;
  let currentGuardianEvidence = null;
  if (actionPreview?.source === "LENDING") {
    const watchedMarket = markets.find((item) => item.marketId?.toLowerCase() === actionPreview.target.id?.toLowerCase());
    if (watchedMarket) currentGuardianEvidence = guardianEvidenceFromLending(watchedMarket, evaluateMarket(watchedMarket, activePolicy));
  } else if (actionPreview) {
    const watchedPool = dexReports.find((item) => item.pool.pairAddress?.toLowerCase() === actionPreview.target.id?.toLowerCase());
    if (watchedPool) currentGuardianEvidence = guardianEvidenceFromDex(watchedPool);
  }
  const guardianReceipt = guardianWatch && guardianObservation ? createGuardianReceipt(guardianWatch, guardianObservation) : null;
  const selectedDurableRegistration = durableGuardianRegistrations.find((item) => item.watch?.target?.id?.toLowerCase() === guardianWatch?.target?.id?.toLowerCase());
  const selectedDurableReceipt = durableGuardianReceipts.find((item) => item.watch?.target?.id?.toLowerCase() === guardianWatch?.target?.id?.toLowerCase());
  const durableGuardianActive = Boolean(selectedDurableRegistration);
  const automationReceipt = automationPolicy ? createAutomationReceipt(automationPolicy, automationEvaluation) : null;
  const interopReceipt = interopState.observation ? createInteropReceipt(interopState.observation) : null;
  const durableInteropVerification = serverRuntime.interop ? verifyReceiptDocument(serverRuntime.interop) : null;
  const holderEntitlements = holderAccess(demoHolderLevel);
  const nextHolderLevel = nextAscension(demoHolderLevel);
  const holderLevelIndex = holderLevels.findIndex((level) => level.id === demoHolderLevel);
  const earnKit = arcAppKitCatalog.find((kit) => kit.id === "earn");
  const onrampKit = arcAppKitCatalog.find((kit) => kit.id === "onramp");
  const borrowKit = arcAppKitCatalog.find((kit) => kit.id === "borrow");
  app.innerHTML = `
    <header class="topbar">
      <a class="brand house-home" href="${h(PRODUCT_LINKS.house)}" aria-label="Back to the CofferHouse">
        <img class="brand-arch" src="/brand/cofferhouse-arch-official.png" alt="">
        <strong class="brand-name" aria-hidden="true"><i>C</i><i>O</i><i>F</i><i>F</i><i>E</i><i>R</i><i>H</i><i>O</i><i>U</i><i>S</i><i>E</i></strong>
        <span>HOLDER CENTER · BACK TO THE HOUSE ↗</span>
      </a>
      <div class="network"><span></span> ARC MAINNET · READ ONLY</div>
    </header>
    <nav class="suite-nav" aria-label="CofferHouse holder tools">
      <div class="suite-nav-inner">
        ${suiteTabs.map((tab) => `<button class="suite-tab ${activeSuiteView === tab.id ? "active" : ""}" data-view="${tab.id}" type="button" aria-current="${activeSuiteView === tab.id ? "page" : "false"}"><span>${tab.mark}</span>${tab.label}</button>`).join("")}
      </div>
    </nav>
    <main>
      <section class="holder-center suite-view ${activeSuiteView === "holder" ? "is-active" : ""}" data-suite-view="holder" id="holder-center" aria-labelledby="holder-center-title">
        <header class="holder-hero">
          <div><p class="eyebrow">YOUR KEY TO THE HOUSE · DEMO MODE</p><h1 id="holder-center-title">Holder Command Center.</h1><p>One place for membership, progression, rewards and the CofferHouse tools unlocked by your access key.</p></div>
          <div class="holder-connection ${holderIdentity.isArc ? "connected" : ""}"><span>WALLET STATUS</span><b>${h(holderIdentity.status.replaceAll("_", " "))}</b><small>${h(holderIdentity.message)}</small>${holderIdentity.address ? `<code title="${h(holderIdentity.address)}">${h(shortId(holderIdentity.address))} · ${holderIdentity.isArc ? "ARC MAINNET" : `CHAIN ${holderIdentity.chainId ?? "?"}`}</code>` : ""}<button class="holder-connect-wallet" type="button" ${holderIdentityBusy || !window.ethereum ? "disabled" : ""}>${holderIdentityBusy ? "CONNECTING…" : holderIdentity.address ? "REFRESH READ-ONLY IDENTITY" : window.ethereum ? "CONNECT READ-ONLY WALLET" : "INSTALL A BROWSER WALLET"}</button></div>
        </header>
        <div class="holder-demo-note"><b>REPRESENTATIVE PREVIEW</b><span>This screen demonstrates the holder experience. It does not claim NFT ownership, token balances, rewards or financial execution.</span></div>
        <section class="onramp-center ${h(onrampState.mode)}" aria-labelledby="onramp-title">
          <div class="onramp-copy"><span>OFFICIAL ARC APP KIT · USER-CONTROLLED FUNDING</span><h2 id="onramp-title">Fund the connected Arc wallet with USDC.</h2><p>${h(onrampKit.capability)} CofferHouse creates only a short-lived hosted session; Circle's widget handles eligibility, payment and settlement.</p><a href="${h(onrampKit.docs)}" target="_blank" rel="noreferrer">OFFICIAL DOCS ↗</a></div>
          <div class="onramp-gates"><b>${onrampState.mode === "checking" ? "CHECKING DEPLOYMENT" : onrampState.readiness?.configured ? "OPERATOR-GATED DEMO READY" : "SETUP REQUIRED"}</b><span>${h(onrampState.message)}</span><ul><li class="${onrampState.readiness?.circleConfigured ? "ready" : "missing"}">Circle server key</li><li class="${onrampState.readiness?.operatorGateConfigured ? "ready" : "missing"}">Protected session gate</li><li class="${holderIdentity.isArc ? "ready" : "missing"}">Connected Arc destination</li><li class="${onrampState.readiness?.referrerConfigured ? "ready" : "review"}">Approved referrer domain</li></ul></div>
          <form class="onramp-session-form">
            <label>DESTINATION WALLET<input name="destinationAddress" type="text" value="${h(holderIdentity.address ?? "")}" placeholder="Connect an Arc wallet above" readonly></label>
            <label>USD AMOUNT<input name="amount" type="number" min="0.01" max="100000" step="0.01" value="100"></label>
            <label>DEMO OPERATOR TOKEN<input name="operatorToken" type="password" autocomplete="off" placeholder="Never stored in the browser"></label>
            <button type="submit" ${!onrampState.readiness?.configured || !holderIdentity.isArc || onrampState.mode === "creating" ? "disabled" : ""}>${onrampState.mode === "creating" ? "CREATING SESSION…" : "PREPARE 30-MIN SESSION"}</button>
          </form>
          ${onrampState.session ? `<div class="onramp-session-ready"><div><span>SESSION READY · EXPIRES ${h(new Date(onrampState.session.expiresAt).toLocaleTimeString())}</span><b>Circle's hosted flow will deliver USDC only to ${h(shortId(onrampState.session.destinationWallet ?? holderIdentity.address))}.</b><small>No purchase, deposit or investment has happened yet.</small></div><a href="${h(safeExternalUrl(onrampState.session.widgetUrl))}" target="_blank" rel="noreferrer">OPEN SECURE ONRAMP ↗</a></div>` : ""}
          <footer><span>NO CUSTODY · NO AUTOMATIC PURCHASE · NO AUTOMATIC INVESTMENT</span><span>${h(onrampKit.boundary)}</span></footer>
        </section>
        <div class="holder-dashboard">
          <article class="holder-key-card">
            <div class="holder-key-art"><img src="/brand/cofferhouse-arch-official.png" alt="CofferHouse access-key arch"><span>ACCESS KEY</span><b>OWNER VIEW</b></div>
            <div><span>NFT / ACCESS KEY</span><h2>Connect to identify your key</h2><p>Card class and token ID will be read from the verified membership contract.</p><dl><div><dt>CARD CLASS</dt><dd>Unavailable</dd></div><div><dt>TOKEN ID</dt><dd>Unavailable</dd></div><div><dt>NETWORK</dt><dd>Arc · pending verification</dd></div></dl></div>
          </article>
          <article class="holder-level-card">
            <span>PROGRESSION LEVEL · PREVIEW</span><h2>Member</h2><p>Permanent progression determines which CofferHouse services become available. Card rarity and progression level are separate.</p>
            <div class="level-rail">${holderLevels.map((level, index) => `<div class="${index <= holderLevelIndex ? "reached" : ""}"><i>${index + 1}</i><span>${h(level.label)}</span></div>`).join("")}</div>
            <footer><span>NEXT LEVEL</span><b>${h(nextHolderLevel?.label ?? "Highest level")}</b><small>${nextHolderLevel ? `${nextHolderLevel.cofferThreshold.toLocaleString("en-US")} $COFFERS threshold · contract verification required` : "All levels reached"}</small></footer>
          </article>
          <article class="holder-balance-card"><span>$COFFERS BALANCE</span><b>—</b><p>Unavailable until wallet and token contract are connected.</p></article>
          <article class="holder-balance-card rewards"><span>REWARDS</span><b>—</b><p>Accrued and claimable amounts will come from verified reward contracts.</p></article>
          <article class="holder-reward-card">
            <div><span>REWARD DESTINATION</span><h2>Choose how future rewards are handled</h2><p>This preference is saved only in this browser. It does not move funds or authorize a transaction.</p></div>
            <form class="holder-reward-form"><label>REWARD MODE<select name="rewardMode">${rewardModes.map((mode) => `<option value="${h(mode.id)}" ${holderPreferences.rewardMode === mode.id ? "selected" : ""}>${h(mode.label)}</option>`).join("")}</select></label><button type="submit">SAVE PREFERENCE</button><output aria-live="polite"></output></form>
          </article>
        </div>
        <section class="holder-tools" aria-labelledby="holder-tools-title"><div class="holder-tools-head"><div><p class="eyebrow">YOUR HOUSE TOOLS</p><h2 id="holder-tools-title">Services by level.</h2></div><p>Research previews may open now. Financial services remain locked until their contracts, controls and eligibility checks are live.</p></div><div class="holder-tool-grid">${holderEntitlements.map((service) => `<article class="${service.unlocked ? "unlocked" : "locked"}"><span>${h(service.status.toUpperCase())} · ${h(holderLevels.find((level) => level.id === service.level)?.label ?? service.level)}</span><h3>${h(service.label)}</h3><p>${h(service.description)}</p>${service.view && service.unlocked ? `<button class="holder-open-tool" data-view="${h(service.view)}" type="button">OPEN ${h(service.label.toUpperCase())} →</button>` : `<button type="button" disabled>${service.unlocked ? "ROADMAP" : `UNLOCKS AT ${h(service.level.toUpperCase())}`}</button>`}</article>`).join("")}</div></section>
        <footer class="holder-boundary"><b>MEMBERSHIP VIEW, NOT A WALLET</b><span>Demo · Read only · No custody · No execution</span></footer>
      </section>
      <section class="hero suite-view ${activeSuiteView === "hub" ? "is-active" : ""}" data-suite-view="hub">
        <div>
          <p class="eyebrow">RISK INTELLIGENCE FOR PROGRAMMABLE MARKETS</p>
          <h1>See the risk<br><em>before</em> the move.</h1>
          <p class="intro">Scout compares tokenized assets and crypto markets on Arc using visible, deterministic rules. No black box. No custody. No execution.</p>
        </div>
        <aside class="hero-note ${feedState.mode}"><b>${feedState.mode === "live" ? "LIVE ARC DATA" : feedState.mode === "loading" ? "CONNECTING" : "SAFE FALLBACK"}</b><p>${h(feedState.message)}</p></aside>
      </section>

      <section class="agent-hub suite-view ${activeSuiteView === "hub" ? "is-active" : ""}" data-suite-view="hub" id="agent-hub" aria-labelledby="agent-hub-title">
        <div class="hub-head">
          <div><p class="eyebrow">COFFERHOUSE AGENT SYSTEM</p><h2 id="agent-hub-title">Agent Hub. ${infoTip("A product map showing what is operational now, what will be built next and how every agent hands evidence to the following stage.")}</h2></div>
          <p>One controlled path from market observation to future bounded execution. Only capabilities marked LIVE are currently available.</p>
        </div>
        <div class="hub-overview" aria-label="Agent Suite status">
          <div><span>ACTIVE MODULES</span><b>${agentCatalog.length}</b><small>Bounded research agents</small></div>
          <div><span>MARKETS OBSERVED</span><b>${agentScan.total}</b><small>${agentScan.counts.REVIEW} review · ${agentScan.counts.REJECT} reject</small></div>
          <div><span>DEX WATCHLIST</span><b>${dexWatchlist.length}</b><small>${dexReports.length} pool observations</small></div>
          <div><span>HUMAN GATE</span><b>${activeActionApproval ? "RECORDED" : actionApproval ? "EXPIRED" : "READY"}</b><small>No wallet authority</small></div>
        </div>
        <section class="mission-control ${h(missionControl.status.toLowerCase())}" aria-labelledby="mission-control-title">
          <div class="mission-control-head"><div><p class="eyebrow">MISSION CONTROL · OPERATOR BRIEF</p><h3 id="mission-control-title">${h(missionControl.headline)}</h3><p>${h(missionControl.detail)}</p></div><div><span>${missionControl.attentionCount} ATTENTION SIGNAL${missionControl.attentionCount === 1 ? "" : "S"}</span><button class="mission-control-action" type="button" data-kind="${h(missionControl.nextAction.kind)}" data-view="${h(missionControl.nextAction.view)}">${h(missionControl.nextAction.label)} →</button></div></div>
          <div class="mission-indicators">${missionControl.indicators.map((item) => `<article class="${h(item.tone)}"><span>${h(item.label)}</span><b>${h(item.value)}</b><small>${h(item.detail)}</small></article>`).join("")}</div>
          <footer><span>NEXT PERMITTED STEP</span><b>${h(missionControl.nextAction.reason)}</b><small>Custody: NO · Signature: NO · Execution: NO</small></footer>
        </section>
        ${serverIncidents.length ? `<section class="incident-inbox" aria-labelledby="incident-inbox-title">
          <div class="incident-inbox-head"><div><span>PROTECTED ATTENTION INBOX</span><h3 id="incident-inbox-title">${serverIncidents.length} ACTIVE INCIDENT${serverIncidents.length === 1 ? "" : "S"}</h3></div><small>Acknowledgment records human review only. It does not change policy or authorize an action.</small></div>
          <div class="incident-list">${serverIncidents.map((incident) => {
            const acknowledged = acknowledgmentFor(incident.fingerprint);
            return `<article class="${acknowledged ? "acknowledged" : h(incident.severity.toLowerCase())}"><div><span>${h(incident.schema.includes("guardian") ? "GUARDIAN" : "SCOUT")} · ${h(incident.severity)}</span><b>${h(incident.title)}</b><p>${h(incident.message)}</p><code>${h(incident.fingerprint)}</code></div>${acknowledged ? `<aside><b>ACKNOWLEDGED</b><span>${h(acknowledged.operator)}</span><small>${h(new Date(acknowledged.acknowledgedAt).toLocaleString())} · ${h(acknowledged.note || "No note")}</small></aside>` : `<form class="incident-ack-form" data-fingerprint="${h(incident.fingerprint)}"><label>OPERATOR<input name="operator" minlength="2" maxlength="80" required></label><label>REVIEW NOTE<input name="note" maxlength="500"></label><label>PROTECTED TOKEN<input name="token" type="password" autocomplete="off" required></label><button type="submit">ACKNOWLEDGE</button></form>`}</article>`;
          }).join("")}</div>
        </section>` : ""}
        <div class="hub-session ${researchSession ? "complete" : "ready"}">
          <div class="hub-session-head">
            <div><span>COORDINATED RESEARCH SESSION ${infoTip("Runs the current Scout, Opportunity and Strategy logic as one bounded mission. DEX joins only when observed pool evidence exists.")}</span><b>${researchSession ? "SESSION COMPLETE" : "READY TO COORDINATE"}</b><small>${researchSession ? `${h(researchSession.summary.decision.replaceAll("_", " "))} · Human gate ${h(researchSession.summary.humanGate)}` : "One command will coordinate the active agents without creating, signing or submitting a transaction."}</small></div>
            <div class="hub-session-actions">
              ${researchSession ? `<button class="hub-session-download" type="button">DOWNLOAD SESSION RECEIPT</button>` : ""}
              <button class="hub-session-run" type="button">${researchSession ? "RUN AGAIN" : "RUN RESEARCH SESSION"}</button>
            </div>
          </div>
          ${researchSession ? `<div class="hub-session-stages" aria-label="Research session stages">
            ${researchSession.stages.map((stage) => `<article class="${h(stage.status.toLowerCase())}"><span>${h(stage.status.replaceAll("_", " "))}</span><b>${h(stage.agent)}</b><small>${h(stage.result)}</small></article>`).join("")}
          </div>
          <div class="hub-session-result"><div><span>LENDING POSITIONS</span><b>${researchSession.summary.lendingPositions}</b></div><div><span>DEX POSITIONS</span><b>${researchSession.summary.dexPositions}</b></div><p>${h(researchSession.notice)}</p></div>
          ${sessionComparison ? `<div class="hub-session-compare"><span>CHANGE FROM PREVIOUS SESSION</span><b>${sessionComparison.decisionChanged ? `${h(sessionComparison.previousDecision)} → ${h(sessionComparison.currentDecision)}` : `DECISION UNCHANGED · ${h(sessionComparison.currentDecision)}`}</b><small>Eligible markets ${sessionComparison.changes.marketsEligible >= 0 ? "+" : ""}${sessionComparison.changes.marketsEligible} · Lending positions ${sessionComparison.changes.lendingPositions >= 0 ? "+" : ""}${sessionComparison.changes.lendingPositions} · DEX pools ${sessionComparison.changes.dexPoolsObserved >= 0 ? "+" : ""}${sessionComparison.changes.dexPoolsObserved}</small></div>` : ""}` : `<p class="hub-session-empty">The Hub will preserve each agent's evidence, show skipped stages honestly and issue one tamper-evident JSON receipt for the complete mission.</p>`}
          ${researchSessionHistory.length ? `<div class="hub-session-history"><div class="hub-history-head"><div><span>SESSION MEMORY · THIS BROWSER</span><b>${researchSessionHistory.length} VERIFIED SESSION${researchSessionHistory.length === 1 ? "" : "S"}</b></div><button class="hub-history-clear" type="button">CLEAR HISTORY</button></div><div class="hub-history-list">${researchSessionHistory.map((item) => `<button type="button" data-receipt-id="${h(item.receiptId)}" class="hub-history-item ${item.receiptId === researchSessionReceipt?.receiptId ? "active" : ""}"><time>${h(new Date(item.generatedAt).toLocaleString())}</time><b>${h(item.summary.decision.replaceAll("_", " "))}</b><small>${item.summary.marketsEligible} eligible · ${item.summary.lendingPositions} lending · ${item.summary.dexPositions} DEX</small><code>${h(item.receiptId)}</code></button>`).join("")}</div></div>` : ""}
          <div class="hub-durable-memory ${serverRuntime.configured ? (serverResearchVerification?.valid ? "online" : "waiting") : "setup"}">
            <div><span>AGENT HUB MEMORY · 24/7</span><b>${!serverRuntime.configured ? "DEPLOYMENT SETUP REQUIRED" : serverResearchVerification?.valid ? `${serverRuntime.researchSessions.length} DURABLE SESSION${serverRuntime.researchSessions.length === 1 ? "" : "S"}` : "WAITING FOR FIRST SCHEDULED SESSION"}</b><small>${!serverRuntime.configured ? `Missing: ${(serverRuntime.deployment?.missingRequired ?? ["durable-memory", "protected-scheduler"]).join(" · ")}` : serverResearchVerification?.valid ? `Latest verified run ${h(new Date(serverRuntime.researchSession.generatedAt).toLocaleString())} · ${h(serverRuntime.researchSession.summary.decision.replaceAll("_", " "))}` : "The next protected agent cycle will coordinate and seal a research session."}</small></div>
            ${serverResearchVerification?.valid ? `<button class="hub-open-server-session" type="button">OPEN LATEST SERVER SESSION</button>` : ""}
          </div>
        </div>
        <div class="hub-flow" aria-label="Agent development sequence">
          ${agentCatalog.map((agent) => `<article class="hub-agent ${h(agent.tone)} ${agent.available ? "available" : "locked"}">
            <div class="hub-agent-top"><span class="hub-order">${String(agent.order).padStart(2, "0")}</span><span class="hub-stage">${h(agent.stage)}</span></div>
            <h3>${h(agent.name)}</h3>
            <p>${h(agent.role)}</p>
            <div class="hub-output"><span>OUTPUT</span><small>${h(agent.output)}</small></div>
            ${agent.available ? `<button class="hub-open-agent" data-target="${h(agent.id)}-agent" type="button">OPEN ${h(agent.name.toUpperCase())} ↓</button>` : `<span class="hub-roadmap-label">${agent.stage === "NEXT BUILD" ? "CURRENT PRODUCT TASK" : "ROADMAP · NOT ACTIVE"}</span>`}
          </article>`).join("")}
        </div>
        <footer class="hub-boundary"><b>CURRENT BOUNDARY</b><span>The Hub coordinates research and records evidence. No agent can custody, sign or execute.</span></footer>
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
          <div><span>DURABLE HISTORY</span><b>${serverRuntime.access === "operator" ? (serverRuntime.history?.length ?? 0) : (serverRuntime.summaryCounts?.cycles ?? 0)} CYCLES</b><small>${serverRuntime.access === "operator" ? "Operator detail unlocked" : "Public aggregate · receipt history protected"}</small></div>
          <div class="runtime-sync ${h(serverRuntime.mode)}"><div><span>STATUS CONNECTION</span><b>${h(runtimeConnection.status)}</b><small>${serverRuntime.lastCheckedAt ? `Checked ${h(new Date(serverRuntime.lastCheckedAt).toLocaleTimeString())}` : h(runtimeConnection.detail)}</small></div><button class="runtime-refresh" type="button" ${serverRuntimeLoading ? "disabled" : ""}>${serverRuntimeLoading ? "REFRESHING…" : "REFRESH STATUS"}</button></div>
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
          ${serverRuntime.deployment ? `<div class="deployment-readiness ${h(serverRuntime.deployment.status.toLowerCase())}"><div><span>PRODUCTION READINESS</span><b>${h(serverRuntime.deployment.status.replaceAll("_", " "))}</b><small>${serverRuntime.deployment.status === "RUNNING" ? `Protected cycle in progress · ${h(serverRuntime.deployment.recovery?.phase?.replaceAll("_", " ") ?? "STARTING")}` : serverRuntime.deployment.status === "DEGRADED_RECOVERABLE" ? "Latest attempt failed safely; the last successful cycle remains available." : serverRuntime.deployment.status === "DEGRADED_INTERRUPTED" ? "An interrupted lock expires automatically so the next scheduled cycle can recover." : serverRuntime.deployment.ageMinutes === null ? "No protected cycle has been recorded yet." : `Last protected cycle ${serverRuntime.deployment.ageMinutes} minute${serverRuntime.deployment.ageMinutes === 1 ? "" : "s"} ago.`}</small></div><div class="deployment-checks">${serverRuntime.deployment.required.map((item) => `<span class="${item.ready ? "ready" : "missing"}">${item.ready ? "✓" : "×"} ${h(item.label)}</span>`).join("")}${serverRuntime.deployment.recommended.map((item) => `<span class="${item.ready ? "ready" : "optional"}">${item.ready ? "✓" : "○"} ${h(item.label)}</span>`).join("")}</div></div>` : ""}
          ${serverRuntime.status?.intelligence ? `<div class="server-analysis"><span>BOUNDED INTELLIGENCE · ${serverRuntime.status.intelligence.source === "gemini" ? "GEMINI" : "DETERMINISTIC"}</span><b>${h(serverRuntime.status.intelligence.priority)} · ${h(serverRuntime.status.intelligence.recommendedAction)}</b><small>${h(serverRuntime.status.intelligence.summary)}</small></div>` : ""}
          ${serverIncidents.length ? `<div class="operator-review"><span>HUMAN OVERSIGHT</span><b>${serverIncidents.filter((incident) => !acknowledgmentFor(incident.fingerprint)).length ? `${serverIncidents.filter((incident) => !acknowledgmentFor(incident.fingerprint)).length} INCIDENT${serverIncidents.filter((incident) => !acknowledgmentFor(incident.fingerprint)).length === 1 ? "" : "S"} REQUIRE ACKNOWLEDGMENT` : "ALL ACTIVE INCIDENTS ACKNOWLEDGED"}</b><small>Open Agent Hub for the unified Scout and Guardian attention inbox.</small><button class="open-incident-inbox" type="button">OPEN INBOX</button></div>` : ""}
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
        <section class="earn-kit-panel ${h(earnKitState.mode)}">
          <div class="app-kit-panel-head"><div><span>OFFICIAL ARC APP KIT · READ ONLY</span><h3>${h(earnKit.label)} opportunity research.</h3><p>${h(earnKit.capability)}</p></div><div><b>${earnKitState.mode === "ready" ? `${earnAnalysis.summary.eligible} OF ${earnAnalysis.summary.total} ELIGIBLE` : earnKitState.mode === "loading" ? "CONNECTING" : "UNAVAILABLE"}</b><small>${h(earnKitState.message)}</small><div class="earn-kit-actions">${earnReceipt ? `<button class="earn-receipt-download" type="button">DOWNLOAD EARN RECEIPT</button>` : ""}<a href="${h(earnKit.docs)}" target="_blank" rel="noreferrer">OFFICIAL DOCS ↗</a></div></div></div>
          <form class="earn-preferences"><label>CAPITAL · USD<input name="capitalUsd" type="number" min="1" step="1" value="${earnOpportunityPreferences.capitalUsd}"></label><label>ASSET<select name="asset"><option value="ANY" ${earnOpportunityPreferences.asset === "ANY" ? "selected" : ""}>ANY</option><option value="USDC" ${earnOpportunityPreferences.asset === "USDC" ? "selected" : ""}>USDC</option><option value="EURC" ${earnOpportunityPreferences.asset === "EURC" ? "selected" : ""}>EURC</option></select></label><label>MIN APY · %<input name="minApyPct" type="number" min="0" step="0.01" value="${earnOpportunityPreferences.minApyPct}"></label><label>MIN LIQUIDITY · USD<input name="minAvailableLiquidityUsd" type="number" min="0" step="1000" value="${earnOpportunityPreferences.minAvailableLiquidityUsd}"></label><label>MIN DEPOSITS · USD<input name="minTotalDepositsUsd" type="number" min="0" step="1000" value="${earnOpportunityPreferences.minTotalDepositsUsd}"></label><label>MAX LIQUIDITY SHARE · %<input name="maxLiquiditySharePct" type="number" min="0.01" max="10" step="0.01" value="${earnOpportunityPreferences.maxLiquiditySharePct}"></label><label class="earn-checkbox"><input name="includeLowLiquidity" type="checkbox" ${earnOpportunityPreferences.includeLowLiquidity ? "checked" : ""}> INCLUDE LOW LIQUIDITY</label><div><button type="submit">APPLY EARN LIMITS</button><button class="earn-preferences-reset" type="button">RESET</button></div></form>
          ${earnAnalysis.opportunities.length ? `<div class="earn-vaults">${earnAnalysis.opportunities.slice(0, 10).map((vault, index) => `<article class="${vault.eligible ? "eligible" : "blocked"}"><span class="earn-rank">${String(index + 1).padStart(2, "0")}</span><div><span>${h(vault.asset)} · ${h(vault.protocol)}</span><h4>${h(vault.name)}</h4><small>${h(shortId(vault.vaultAddress))}</small><p>${h(vault.reason)}</p></div><div><span>RESEARCH SCORE</span><b>${vault.researchScore}</b></div><div><span>OBSERVED APY</span><b>${formatPct(vault.apyPct, 3)}</b></div><div><span>AVAILABLE LIQUIDITY</span><b>${formatMoney(vault.availableLiquidityUsd)}</b></div><div><span>MAX RESEARCH SIZE</span><b>${formatMoney(vault.maxResearchAmountUsd)}</b></div><em>${vault.eligible ? "RESEARCH" : "BLOCKED"}</em></article>`).join("")}</div>` : ""}
          <footer><span>${h(earnKit.boundary)}</span><span>Discovery only · No deposit · No withdrawal</span></footer>
        </section>
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
        <section class="earn-strategy-branch" aria-labelledby="earn-strategy-title">
          <div class="earn-strategy-head"><div><span>OFFICIAL ARC EARN KIT · SEPARATE EVIDENCE BRANCH</span><h3 id="earn-strategy-title">Earn vault allocation research.</h3><p>Uses the same capital bounds, but never merges or double-counts vault evidence with Morpho market evidence.</p></div><button class="earn-strategy-download" type="button">DOWNLOAD EARN STRATEGY RECEIPT</button></div>
          <div class="earn-strategy-summary"><b>${earnStrategyProposal.summary.vaults} VAULT${earnStrategyProposal.summary.vaults === 1 ? "" : "S"}</b><span>${formatMoney(earnStrategyProposal.summary.allocatedUsd)} modeled · ${formatPct(earnStrategyProposal.summary.weightedObservedApyPct, 3)} observed weighted APY</span></div>
          ${earnKitState.mode === "loading" ? `<div class="strategy-empty"><b>DISCOVERING OFFICIAL VAULTS</b><p>Strategy Lab will build this branch after Earn Kit evidence arrives.</p></div>` : earnStrategyProposal.positions.length ? `<div class="earn-strategy-positions">${earnStrategyProposal.positions.map((position, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><div><h4>${h(position.name)}</h4><small>${h(position.asset)} · ${h(position.protocol)} · ${h(shortId(position.vaultAddress))}</small><p>Research score ${position.researchScore} · ${h(position.status)}${position.warnings[0] ? ` · ${h(position.warnings[0])}` : ""}</p></div><strong>${formatMoney(position.amountUsd)}</strong><div><b>${formatPct(position.observedApyPct, 3)}</b><small>OBSERVED APY</small></div><details><summary>REVIEW CONDITIONS</summary>${position.reviewConditions.map((condition) => `<p>${h(condition)}</p>`).join("")}</details></article>`).join("")}</div>` : `<div class="strategy-empty"><b>NO ELIGIBLE EARN ALLOCATION</b><p>No official Earn vault clears both the active Earn filters and Strategy bounds.</p></div>`}
          <footer><span>${h(earnStrategyProposal.status.replaceAll("_", " "))} · ${earnStrategyReceipt.receiptId}</span><span>No deposit · No approval · No signature · No execution</span></footer>
        </section>
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
          <div class="action-head-actions">${actionReceipt ? `<button class="action-download" type="button">DOWNLOAD ACTION RECEIPT</button>` : ""}${actionPreview ? `<button class="action-clear" type="button">CLEAR WORKSPACE</button>` : ""}</div>
        </div>
        <section class="borrow-kit-center" aria-labelledby="borrow-kit-title">
          <div class="borrow-kit-head"><div><span>OFFICIAL ARC BORROW KIT · READ-ONLY SIZING</span><h3 id="borrow-kit-title">Preview a cirBTC-backed USDC loan.</h3><p>${h(borrowKit.capability)} The preview asks Borrow Kit for collateral sizing and liquidation evidence before any wallet action exists.</p></div><div><b>${borrowKitState.mode === "ready" ? `${borrowKitState.data.markets.length} CIRBTC MARKET${borrowKitState.data.markets.length === 1 ? "" : "S"}` : borrowKitState.mode === "loading" ? "DISCOVERING MARKETS" : "BORROW KIT UNAVAILABLE"}</b><small>${h(borrowKitState.message)}</small><a href="${h(borrowKit.docs)}" target="_blank" rel="noreferrer">OFFICIAL DOCS ↗</a></div></div>
          <form class="borrow-kit-form">
            <label>MARKET<select name="marketId" ${borrowKitState.data?.markets.length ? "" : "disabled"}>${borrowKitState.data?.markets.map((market) => `<option value="${h(market.marketId)}">${h(shortId(market.marketId))} · ${formatMoney(market.liquidityUsd)} liquidity · ${formatPct(market.utilizationPct, 2)} utilized</option>`).join("") ?? `<option>No live cirBTC market</option>`}</select></label>
            <label>BORROW · USDC<input name="borrowAmount" type="number" min="0.01" max="1000000" step="0.01" value="100"></label>
            <label>TARGET HEALTH FACTOR<input name="targetHealthFactor" type="number" min="1.2" max="5" step="0.05" value="1.5"></label>
            <button type="submit" ${borrowKitState.data?.markets.length && borrowKitState.mode !== "quoting" ? "" : "disabled"}>${borrowKitState.mode === "quoting" ? "CALCULATING…" : "CALCULATE COLLATERAL"}</button>
          </form>
          ${borrowKitState.preview ? `<div class="borrow-kit-result ${h(borrowKitState.preview.healthFactorBand.toLowerCase())}">
            <div class="borrow-verdict"><span>HEALTH BAND</span><b>${h(borrowKitState.preview.healthFactorBand)}</b><small>Health factor ${borrowKitState.preview.resultingHealthFactor.toFixed(3)}</small></div>
            <div><span>BORROW</span><b>${formatMoney(borrowKitState.preview.borrowAmountUsdc)}</b><small>USDC requested</small></div>
            <div><span>REQUIRED COLLATERAL</span><b>${borrowKitState.preview.requiredCollateral.amount?.toFixed(8) ?? "Unavailable"}</b><small>${h(borrowKitState.preview.requiredCollateral.token)}</small></div>
            <div><span>LIQUIDATION PRICE</span><b>${formatMoney(borrowKitState.preview.liquidationPrice.amount)}</b><small>denominated in ${h(borrowKitState.preview.liquidationPrice.token)}</small></div>
            <div><span>MARKET UTILIZATION</span><b>${formatPct(borrowKitState.preview.market.utilizationPct, 3)}</b><small>${formatMoney(borrowKitState.preview.market.liquidityUsd)} liquidity</small></div>
            <div class="borrow-kit-warnings"><b>${borrowKitState.preview.warnings.length} REVIEW CONDITION${borrowKitState.preview.warnings.length === 1 ? "" : "S"}</b>${borrowKitState.preview.warnings.map((warning) => `<p>${h(warning)}</p>`).join("")}</div>
            <button class="borrow-preview-download" type="button">DOWNLOAD BORROW RECEIPT</button>
          </div>` : `<div class="borrow-kit-empty"><b>NO BORROW PREVIEW YET</b><p>Select a live market, amount and target health factor. The calculation does not connect a wallet or prepare a transaction.</p></div>`}
          <footer><span>WALLET: NONE · APPROVAL: NONE · SIGNATURE: NONE · LOAN: NONE</span><span>${h(borrowKit.boundary)}</span></footer>
        </section>
        <form class="action-builder">
          <label>MODELED POSITION<select name="choice" ${actionChoices.length ? "" : "disabled"}>${actionChoices.length ? actionChoices.map((item) => `<option value="${h(item.key)}">${h(item.label)}</option>`).join("") : `<option>No eligible Strategy position</option>`}</select></label>
          <button type="submit" ${actionChoices.length ? "" : "disabled"}>CREATE READ-ONLY PREVIEW</button>
        </form>
        <div class="action-status ${actionPreview ? actionPreview.status.toLowerCase() : "idle"}"><b>${actionPreview ? h(actionPreview.status.replaceAll("_", " ")) : "NO ACTIVE INTENT"}</b><span>${h(actionMessage)}</span></div>
        ${actionPreview ? `<div class="action-preview">
          <div class="action-intent"><div><span>INTENT</span><b>${h(actionPreview.intent.kind.replaceAll("_", " "))}</b></div><div><span>TARGET</span><b>${h(actionPreview.target.name)}</b><small>${h(shortId(actionPreview.target.id))}</small></div><div><span>MODELED AMOUNT</span><b>${formatMoney(actionPreview.intent.amountUsd)}</b></div><div><span>NETWORK</span><b>${h(actionPreview.network)} · ${actionPreview.chainId}</b></div></div>
          <div class="action-checks">${actionPreview.checks.map((item) => `<article class="${h(item.outcome)}"><span>${item.outcome === "pass" ? "✓" : item.outcome === "block" ? "×" : "!"}</span><div><b>${h(item.label)}</b><small>${h(item.detail)}</small></div></article>`).join("")}</div>
          <details class="action-missing" open><summary>REQUIRED BEFORE ANY REAL EXECUTION</summary>${actionPreview.missingBeforeExecution.map((item) => `<p>${h(item)}</p>`).join("")}</details>
          ${actionPreview.status !== "BLOCKED" && !activeActionApproval ? `${actionApproval ? `<div class="action-expired"><b>HUMAN GATE EXPIRED</b><span>The prior review remains in the receipt history, but it no longer authorizes preparation or permission testing. Record a fresh review to continue.</span></div>` : ""}<form class="action-approval-form">
            <div><label>OPERATOR NAME<input name="operator" type="text" minlength="2" maxlength="80" required></label><label>OPTIONAL REVIEW NOTE<textarea name="note" maxlength="500" rows="2"></textarea></label></div>
            <div class="action-confirmations"><p>One approval confirms that this preview does not execute, that the visible warnings were presented, and that a fresh simulation is required before any future signature.</p><label><input name="informedApproval" type="checkbox" required> I understand and approve this intent for manual preparation only.</label></div>
            <button type="submit">APPROVE FOR MANUAL PREPARATION ONLY</button>
          </form>` : activeActionApproval ? `<div class="action-approved"><b>HUMAN GATE RECORDED</b><span>${h(activeActionApproval.operator)} · ${h(activeActionApproval.decision.replaceAll("_", " "))}</span><small>Expires ${h(new Date(activeActionApproval.expiresAt).toLocaleString())}. This is not a wallet signature.</small></div>` : `<div class="action-blocked"><b>PREVIEW BLOCKED</b><span>Correct every blocking identity or evidence check before requesting human approval.</span></div>`}
        </div>` : `<div class="action-empty"><b>NO TRANSACTION IS IMPLIED</b><p>Choose a position produced by Strategy Lab. Action Center will preserve its source receipt and expose the remaining authorization boundary.</p></div>`}
        <footer><span>${actionReceipt ? h(actionReceipt.receiptId) : "NO ACTION RECEIPT YET"}</span><span>Prepared: NO · Signed: NO · Submitted: NO</span></footer>
      </section>

      <section class="guardian-agent suite-view ${activeSuiteView === "guardian" ? "is-active" : ""}" data-suite-view="guardian" id="guardian-agent" aria-labelledby="guardian-title">
        <div class="guardian-head"><div><p class="eyebrow">GUARDIAN · RESEARCH MONITOR</p><h2 id="guardian-title">Watch the approved intent, not imaginary funds. ${infoTip("Guardian records a baseline for the Action Center intent and compares later evidence. Until execution exists, it never calls this a funded position.")}</h2><p>Detect deteriorating liquidity, utilization, price movement, modeled impact or policy status and route any response back through human review.</p></div><div class="guardian-actions">${guardianReceipt ? `<button class="guardian-download" type="button">DOWNLOAD RECEIPT</button>` : ""}${activeActionApproval && !guardianWatch ? `<button class="guardian-start" type="button" ${currentGuardianEvidence ? "" : "disabled"}>START WATCH</button>` : guardianWatch ? `<button class="guardian-check" type="button">CHECK FRESH EVIDENCE</button>` : ""}</div></div>
        ${!guardianWatch && !activeActionApproval ? `<div class="guardian-empty"><b>${actionApproval ? "HUMAN GATE EXPIRED" : "WAITING FOR AN APPROVED INTENT"}</b><p>${actionApproval ? "Return to Action Center and record a fresh human review before creating a new Guardian baseline." : "Create and approve an Action Center preview once. Guardian cannot invent a target or monitor an unapproved proposal."}</p></div>` : !guardianWatch ? `<div class="guardian-ready"><b>BASELINE READY</b><span>${currentGuardianEvidence ? `Current evidence found for ${h(actionPreview.target.name)}.` : "The selected target is not present in the current data."}</span></div>` : `<div class="guardian-body">
          <div class="guardian-verdict ${guardianObservation.decision.toLowerCase()}"><div><span>CURRENT DECISION</span><b>${h(guardianObservation.decision.replaceAll("_", " "))}</b><small>${guardianObservation.requiresHumanAttention ? "Human attention required" : "Inside recorded limits"}</small></div><div><span>WATCHED INTENT</span><b>${h(guardianWatch.intent.kind.replaceAll("_", " "))}</b><small>${h(guardianWatch.target.name)} · ${formatMoney(guardianWatch.intent.amountUsd)}</small></div><div><span>BASELINE</span><b>${h(new Date(guardianWatch.createdAt).toLocaleString())}</b><small>${h(shortId(guardianWatch.target.id))}</small></div></div>
          <div class="guardian-reasons">${guardianObservation.reasons.map((reason) => `<p>${h(reason)}</p>`).join("")}</div>
          <div class="guardian-comparison"><div><span>BASELINE LIQUIDITY</span><b>${formatMoney(guardianWatch.baseline.liquidityUsd)}</b></div><div><span>CURRENT LIQUIDITY</span><b>${formatMoney(guardianObservation.current?.liquidityUsd)}</b></div><div><span>BASELINE STATUS</span><b>${h(guardianWatch.baseline.status)}</b></div><div><span>CURRENT STATUS</span><b>${h(guardianObservation.current?.status ?? "MISSING")}</b></div></div>
          <div class="guardian-boundary"><b>NO AUTOMATED EXIT</b><span>Guardian can propose attention or stopping research. Any future rebalance, withdrawal or swap must create a new Action Center intent.</span></div>
        </div>`}
        <section class="guardian-durable ${durableGuardianActive ? "active" : "idle"}">
          <div><span>GUARDIAN · 24/7 SERVER WATCHLIST</span><b>${durableGuardianRegistrations.length} / 20 ACTIVE</b><small>${h(durableGuardianMessage)}</small></div>
          ${durableGuardianActive && selectedDurableReceipt ? `<div class="guardian-durable-result"><span>SELECTED MARKET · LATEST DECISION</span><b>${h(selectedDurableReceipt.observation.decision.replaceAll("_", " "))}</b><small>${h(new Date(selectedDurableReceipt.generatedAt).toLocaleString())} · ${serverRuntime.guardianHistory.length} stored receipt${serverRuntime.guardianHistory.length === 1 ? "" : "s"}</small></div>` : ""}
          ${durableGuardianRegistrations.length ? `<div class="guardian-durable-list">${durableGuardianRegistrations.map((item) => { const latest = durableGuardianReceipts.find((receipt) => receipt.watch?.target?.id?.toLowerCase() === item.watch?.target?.id?.toLowerCase()); return `<article><span>${h(shortId(item.watch.target.id))}</span><b>${h(item.watch.target.name)}</b><small>${latest ? h(latest.observation.decision.replaceAll("_", " ")) : "WAITING FOR NEXT CYCLE"}</small></article>`; }).join("")}</div>` : ""}
          ${guardianWatch?.source !== "LENDING" && guardianWatch ? `<p>Durable DEX monitoring remains disabled until the server has an independently configured DEX observation source.</p>` : guardianWatch && serverRuntime.configured && serverRuntime.capabilities.humanAcknowledgment ? `<form class="guardian-durable-form"><label>OPERATOR TOKEN<input name="token" type="password" autocomplete="off" required></label><button type="submit">${durableGuardianActive ? "UPDATE THIS WATCH" : "ADD TO 24/7 WATCHLIST"}</button>${durableGuardianActive ? `<button class="guardian-durable-stop" type="button">REMOVE THIS WATCH</button>` : ""}</form>` : `<p>${guardianWatch ? "Configure durable memory and the protected operator token before registering this watch." : "Create a Guardian watch to make durable registration available."}</p>`}
        </section>
        <footer><span>${guardianReceipt ? h(guardianReceipt.receiptId) : "NO GUARDIAN RECEIPT YET"}</span><span>Automated action: NO · Transaction: NONE</span></footer>
      </section>

      <section class="automation-agent suite-view ${activeSuiteView === "automation" ? "is-active" : ""}" data-suite-view="automation" id="automation-agent" aria-labelledby="automation-title">
        <div class="automation-head"><div><p class="eyebrow">AUTOMATION · PERMISSION SANDBOX</p><h2 id="automation-title">Prove the limits before installing permissions. ${infoTip("Models an exact-target, exact-intent, capped and expiring permission. Nothing is installed in a wallet, smart account or contract.")}</h2><p>Test whether a hypothetical request would clear every allowlist, cap, expiry, Guardian and human-approval gate.</p></div>${automationReceipt ? `<button class="automation-download" type="button">DOWNLOAD RECEIPT</button>` : ""}</div>
        ${!guardianWatch ? `<div class="automation-empty"><b>WAITING FOR GUARDIAN</b><p>Automation cannot define permissions until an approved intent has a Guardian baseline.</p></div>` : !automationPolicy && !activeActionApproval ? `<div class="automation-empty"><b>FRESH HUMAN GATE REQUIRED</b><p>The Guardian watch remains valid evidence, but the prior approval expired. Reapprove the intent in Action Center before modeling a new policy.</p></div>` : !automationPolicy ? `<form class="automation-policy-form">
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

      <section class="interop-agent suite-view ${activeSuiteView === "interop" ? "is-active" : ""}" data-suite-view="interop" id="interop-agent" aria-labelledby="interop-title">
        <div class="interop-head"><div><p class="eyebrow">INTEROP OBSERVER · CCTP V2</p><h2 id="interop-title">Follow crosschain evidence, not promises. ${infoTip("Reads recent events from Arc's documented CCTP V2 contracts. It does not bridge assets, quote a route or access a wallet.")}</h2><p>Observe outbound burns and inbound received messages on Arc, ordered by block number and log index for deterministic reconciliation.</p></div><div class="interop-actions">${interopReceipt ? `<button class="interop-download" type="button">DOWNLOAD RECEIPT</button>` : ""}<button class="interop-scan" type="button" ${interopState.mode === "loading" ? "disabled" : ""}>${interopState.mode === "loading" ? "OBSERVING…" : "OBSERVE CCTP"}</button></div></div>
        <div class="interop-capabilities">${interopCapabilityRegistry.map((item) => `<article class="${h(item.status.toLowerCase())}"><span>${h(item.status)}</span><b>${h(item.id.replaceAll("_", " "))}</b><small>${h(item.detail)}</small></article>`).join("")}</div>
        <div class="interop-status ${h(interopState.mode)}"><b>${interopState.mode === "ready" ? `${interopState.observation.counts.total} VERIFIED EVENT${interopState.observation.counts.total === 1 ? "" : "S"}` : interopState.mode === "error" ? "OBSERVATION UNAVAILABLE" : "READY FOR READ-ONLY OBSERVATION"}</b><span>${h(interopState.message)}</span></div>
        ${interopState.observation ? `<div class="interop-summary"><div><span>OUTBOUND BURNS</span><b>${interopState.observation.counts.outbound}</b></div><div><span>INBOUND MESSAGES</span><b>${interopState.observation.counts.inbound}</b></div><div><span>BLOCK RANGE</span><b>${interopState.observation.range.fromBlock} → ${interopState.observation.range.toBlock}</b></div><div><span>ORDERING</span><b>BLOCK + LOG INDEX</b></div></div><div class="interop-events">${interopState.observation.events.length ? interopState.observation.events.map((event) => `<article><span class="${event.direction.toLowerCase()}">${h(event.direction)}</span><div><b>${h(event.event)}</b><small>Block ${event.blockNumber.toLocaleString()} · Log ${event.logIndex}</small></div><div><span>${event.direction === "OUTBOUND" ? "AMOUNT" : "SOURCE DOMAIN"}</span><b>${event.direction === "OUTBOUND" ? `${h(event.amount)} stablecoin units` : h(String(event.sourceDomain))}</b></div><a href="https://arc.etherscan.io/tx/${h(event.transactionHash)}" target="_blank" rel="noreferrer">${h(shortId(event.transactionHash))} ↗</a></article>`).join("") : `<p>No matching CCTP V2 events were emitted in this bounded block window. Zero events is a valid observation, not proof that crosschain liquidity is unavailable.</p>`}</div>` : ""}
        <div class="interop-contracts"><div><span>OUTBOUND CONTRACT</span><a href="${explorerAddress(ARC_CCTP_CONTRACTS.tokenMessengerV2)}" target="_blank" rel="noreferrer">${h(shortId(ARC_CCTP_CONTRACTS.tokenMessengerV2))} ↗</a></div><div><span>INBOUND CONTRACT</span><a href="${explorerAddress(ARC_CCTP_CONTRACTS.messageTransmitterV2)}" target="_blank" rel="noreferrer">${h(shortId(ARC_CCTP_CONTRACTS.messageTransmitterV2))} ↗</a></div></div>
        <section class="interop-durable ${durableInteropVerification?.valid ? "online" : "waiting"}"><div><span>INTEROP · 24/7 EVIDENCE</span><b>${!serverRuntime.configured ? "DURABLE STORE NOT CONNECTED" : durableInteropVerification?.valid ? `${serverRuntime.interopHistory.length} VERIFIED CYCLE${serverRuntime.interopHistory.length === 1 ? "" : "S"}` : serverRuntime.capabilities.arcRpcVerification ? "WAITING FOR PROTECTED CYCLE" : "ARC RPC REQUIRED"}</b><small>${durableInteropVerification?.valid ? `Latest: ${serverRuntime.interop.observation.counts.outbound} outbound · ${serverRuntime.interop.observation.counts.inbound} inbound · ${serverRuntime.interop.observation.comparison ? `${serverRuntime.interop.observation.comparison.newEvents} new · ` : ""}${h(new Date(serverRuntime.interop.generatedAt).toLocaleString())}` : "Each protected Scout cycle can seal a separate CCTP observation without keeping a browser open."}</small></div>${durableInteropVerification?.valid ? `<button class="interop-open-durable" type="button">OPEN LATEST</button>` : ""}</section>
        <section class="settlement-map"><div><p class="eyebrow">STABLEFX · DOCUMENTED WORKFLOW</p><h3>Quote → Execute → Confirm intent → Fund → Settle</h3></div><p>This maps the published settlement lifecycle only. CofferHouse has no StableFX API, account or execution authority connected, so no quote or settlement is presented as live.</p></section>
        <footer><span>Source: Arc JSON-RPC · official CCTP V2 contracts</span><span>Custody: NO · Signature: NO · Bridge execution: NO</span></footer>
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

  document.querySelectorAll(".suite-tab").forEach((button) => button.addEventListener("click", () => openSuiteView(button.dataset.view)));
  document.querySelectorAll(".holder-open-tool").forEach((button) => button.addEventListener("click", () => openSuiteView(button.dataset.view)));
  document.querySelector(".holder-connect-wallet")?.addEventListener("click", async () => {
    holderIdentityBusy = true;
    render();
    try {
      holderIdentity = await readHolderIdentity(window.ethereum);
    } catch {
      holderIdentity = Object.freeze({ ...disconnectedHolderIdentity(true), status: "DECLINED", message: "The wallet request was declined or unavailable. No signature or transaction was requested." });
    } finally {
      holderIdentityBusy = false;
      render();
    }
  });
  document.querySelector(".holder-reward-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    holderPreferences = saveHolderPreferences(window.localStorage, { rewardMode: new FormData(event.currentTarget).get("rewardMode") });
    event.currentTarget.querySelector("output").textContent = "Preference saved in this browser ✓";
  });
  document.querySelector(".onramp-session-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onrampState = { ...onrampState, mode: "creating", message: "Requesting a short-lived Circle session…", session: null };
    render();
    try {
      const payload = await requestOnrampSession({ destinationAddress: values.get("destinationAddress"), amount: values.get("amount"), operatorToken: values.get("operatorToken") });
      onrampState = { ...onrampState, mode: "ready", message: "Short-lived session created. Review the destination before opening Circle's hosted flow.", session: payload.session };
    } catch (error) {
      onrampState = { ...onrampState, mode: "error", message: error.message ?? "Onramp session could not be created.", session: null };
    }
    render();
  });
  document.querySelector(".interop-scan")?.addEventListener("click", observeInterop);
  document.querySelector(".interop-download")?.addEventListener("click", () => downloadScoutReceipt(interopReceipt));
  document.querySelector(".interop-open-durable")?.addEventListener("click", () => {
    interopState = { mode: "ready", message: "Loaded the latest verified observation from durable server memory.", observation: serverRuntime.interop.observation };
    render();
  });
  document.querySelectorAll(".market-button").forEach((button) => button.addEventListener("click", () => {
    selectedId = button.dataset.id;
    simulationAmount = suggestedBorrowAmount(markets.find((market) => market.id === selectedId));
    simulationHasRun = false;
    render();
  }));
  document.querySelectorAll(".hub-open-agent").forEach((button) => button.addEventListener("click", () => openSuiteView(button.dataset.target.replace("-agent", ""))));
  document.querySelector(".mission-control-action")?.addEventListener("click", (event) => {
    if (event.currentTarget.dataset.kind === "RUN_SESSION") document.querySelector(".hub-session-run")?.click();
    else openSuiteView(event.currentTarget.dataset.view);
  });
  document.querySelector(".hub-session-run")?.addEventListener("click", () => {
    researchSession = runResearchSession({
      markets,
      policy: activePolicy,
      opportunityPreferences,
      strategyPreferences,
      dexReports,
      dexOpportunityPreferences,
      dexStrategyPreferences,
      dexQuoteStates: dexQuotes
    });
    const completedReceipt = createResearchSessionReceipt(researchSession);
    researchSessionHistory = addResearchSessionReceipt(researchSessionHistory, completedReceipt);
    saveResearchSessionHistory(window.localStorage, researchSessionHistory);
    render();
    document.querySelector(".hub-session")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelector(".hub-session-download")?.addEventListener("click", () => downloadScoutReceipt(researchSessionReceipt));
  document.querySelectorAll(".hub-history-item").forEach((button) => button.addEventListener("click", () => {
    const receipt = researchSessionHistory.find((item) => item.receiptId === button.dataset.receiptId);
    if (!receipt) return;
    researchSession = researchSessionFromReceipt(receipt);
    resetOperatorState("Historical research session selected. Create a new read-only preview if you want to inspect one of its modeled positions.");
    render();
  }));
  document.querySelector(".hub-history-clear")?.addEventListener("click", () => {
    researchSessionHistory = clearResearchSessionHistory(window.localStorage);
    researchSession = null;
    render();
  });
  document.querySelector(".hub-open-server-session")?.addEventListener("click", () => {
    const receipt = serverRuntime.researchSession;
    if (!verifyReceiptDocument(receipt).valid) return;
    researchSession = researchSessionFromReceipt(receipt);
    researchSessionHistory = addResearchSessionReceipt(researchSessionHistory, receipt);
    saveResearchSessionHistory(window.localStorage, researchSessionHistory);
    resetOperatorState("Durable server research selected. Review its evidence before creating a new read-only action preview.");
    render();
  });
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
  document.querySelector(".earn-preferences")?.addEventListener("submit", (event) => {
    event.preventDefault();
    earnOpportunityPreferences = saveEarnOpportunityPreferences(window.localStorage, Object.fromEntries(new FormData(event.currentTarget)));
    render();
  });
  document.querySelector(".earn-preferences-reset")?.addEventListener("click", () => {
    earnOpportunityPreferences = saveEarnOpportunityPreferences(window.localStorage, defaultEarnOpportunityPreferences);
    render();
  });
  document.querySelector(".earn-receipt-download")?.addEventListener("click", () => downloadScoutReceipt(earnReceipt));
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
  document.querySelector(".earn-strategy-download")?.addEventListener("click", () => downloadScoutReceipt(earnStrategyReceipt));
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
  document.querySelector(".borrow-kit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    borrowKitState = { ...borrowKitState, mode: "quoting", message: "Calculating collateral with Circle Arc Borrow Kit…", preview: null };
    render();
    try {
      const preview = await requestBorrowPreview({ marketId: values.get("marketId"), borrowAmount: values.get("borrowAmount"), targetHealthFactor: values.get("targetHealthFactor") });
      borrowKitState = { ...borrowKitState, mode: "ready", message: "Fresh read-only sizing returned by Borrow Kit.", preview };
    } catch (error) {
      borrowKitState = { ...borrowKitState, mode: "error", message: error.message ?? "Borrow Kit preview failed.", preview: null };
    }
    render();
  });
  document.querySelector(".borrow-preview-download")?.addEventListener("click", () => downloadScoutReceipt(borrowPreviewReceipt));
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
    persistOperatorState();
    render();
    document.querySelector(".action-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector(".action-approval-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      actionApproval = createActionApproval({ preview: actionPreview, operator: values.get("operator"), note: values.get("note"), informedApproval: values.get("informedApproval") });
      guardianWatch = null;
      guardianObservation = null;
      automationPolicy = null;
      automationEvaluation = null;
      actionMessage = "Human review recorded for manual preparation only; no wallet authorization exists.";
      persistOperatorState();
    } catch (error) { actionMessage = error.message; }
    render();
  });
  document.querySelector(".action-download")?.addEventListener("click", () => downloadScoutReceipt(actionReceipt));
  document.querySelector(".action-clear")?.addEventListener("click", () => {
    resetOperatorState("Operator workspace cleared. Select a modeled position to begin a new bounded review.");
    render();
  });
  document.querySelector(".guardian-start")?.addEventListener("click", () => {
    if (!isActionApprovalFresh(actionApproval)) return;
    guardianWatch = createGuardianWatch({ preview: actionPreview, approval: actionApproval, evidence: currentGuardianEvidence });
    guardianObservation = evaluateGuardian(guardianWatch, currentGuardianEvidence);
    persistOperatorState();
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
    persistOperatorState();
    render();
  });
  document.querySelector(".guardian-download")?.addEventListener("click", () => downloadScoutReceipt(guardianReceipt));
  document.querySelector(".guardian-durable-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get("token");
    durableGuardianMessage = "Registering the sealed watch…";
    try {
      const response = await fetch("/api/guardian/watch", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(guardianReceipt) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Guardian registration failed.");
      durableGuardianMessage = `Sealed watch saved. ${payload.watchCount} market${payload.watchCount === 1 ? "" : "s"} will be evaluated during every protected cycle.`;
      await loadServerRuntimeStatus();
    } catch (error) {
      durableGuardianMessage = error.message ?? "Guardian registration failed.";
    }
    render();
  });
  document.querySelector(".guardian-durable-stop")?.addEventListener("click", async () => {
    const token = document.querySelector('.guardian-durable-form input[name="token"]')?.value;
    if (!token) return;
    try {
      const response = await fetch(`/api/guardian/watch?target=${encodeURIComponent(guardianWatch.target.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Guardian removal failed.");
      durableGuardianMessage = `Selected watch removed. ${payload.watchCount} durable watch${payload.watchCount === 1 ? "" : "es"} remain; historical receipts are preserved.`;
      await loadServerRuntimeStatus();
    } catch (error) {
      durableGuardianMessage = error.message ?? "Guardian removal failed.";
    }
    render();
  });
  document.querySelector(".automation-policy-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isActionApprovalFresh(actionApproval)) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    automationPolicy = createPermissionPolicy({ watch: guardianWatch, ...values });
    automationEvaluation = null;
    persistOperatorState();
    render();
  });
  document.querySelector(".automation-evaluation-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    automationEvaluation = evaluatePermissionRequest({ policy: automationPolicy, targetId: guardianWatch.target.id, intentKind: guardianWatch.intent.kind, amountUsd: values.amountUsd, spentTodayUsd: values.spentTodayUsd, guardianDecision: guardianObservation?.decision, humanApprovalFresh: isActionApprovalFresh(actionApproval) });
    persistOperatorState();
    render();
  });
  document.querySelector(".automation-pause")?.addEventListener("click", () => { automationPolicy = pausePermissionPolicy(automationPolicy); automationEvaluation = null; persistOperatorState(); render(); });
  document.querySelector(".automation-revoke")?.addEventListener("click", () => { automationPolicy = revokePermissionPolicy(automationPolicy); automationEvaluation = null; persistOperatorState(); render(); });
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
  document.querySelector(".runtime-refresh")?.addEventListener("click", () => loadServerRuntimeStatus({ showProgress: true }));
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
  document.querySelector(".open-incident-inbox")?.addEventListener("click", () => openSuiteView("hub"));
  document.querySelectorAll(".incident-ack-form").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    button.textContent = "RECORDING…";
    const response = await fetch("/api/agent/acknowledge", {
      method: "POST",
      headers: { Authorization: `Bearer ${values.get("token")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: event.currentTarget.dataset.fingerprint, operator: values.get("operator"), note: values.get("note") })
    });
    const result = await response.json();
    if (!response.ok) window.alert(result.error ?? "Acknowledgment failed.");
    await loadServerRuntimeStatus();
  }));
}

async function observeInterop() {
  interopState = { mode: "loading", message: "Reading a bounded recent block window from the official Arc CCTP V2 contracts…", observation: interopState.observation };
  render();
  try {
    const response = await fetch("/api/interop/observe?blocks=250", { headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `Interop observation failed (${response.status}).`);
    interopState = { mode: "ready", message: `${payload.observation.counts.outbound} outbound burn${payload.observation.counts.outbound === 1 ? "" : "s"} and ${payload.observation.counts.inbound} inbound message${payload.observation.counts.inbound === 1 ? "" : "s"} found in the bounded window.`, observation: payload.observation };
  } catch (error) {
    interopState = { mode: "error", message: error.message ?? "Interop observation failed safely.", observation: null };
  }
  render();
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

async function loadEarnKitVaults() {
  earnKitState = { mode: "loading", message: "Discovering official Arc Earn vaults…", data: null };
  render();
  try {
    const data = await fetchArcEarnVaults();
    earnKitState = {
      mode: "ready",
      message: `${data.summary.usdc} USDC and ${data.summary.eurc} EURC vaults returned by Circle's Arc Earn Kit.`,
      data
    };
  } catch (error) {
    earnKitState = { mode: "error", message: error?.message ?? "Earn Kit discovery is unavailable.", data: null };
  }
  render();
}

async function loadOnrampReadiness() {
  try {
    const readiness = await fetchOnrampReadiness();
    onrampState = { mode: "ready", message: readiness.configured ? "Server key and protected demo gate are configured." : "Add the missing server configuration before minting a session.", readiness, session: null };
  } catch (error) {
    onrampState = { mode: "error", message: error.message ?? "Onramp readiness is unavailable.", readiness: null, session: null };
  }
  render();
}

async function loadBorrowKitMarkets() {
  borrowKitState = { mode: "loading", message: "Discovering official cirBTC/USDC markets…", data: null, preview: null };
  render();
  try {
    const data = await fetchArcBorrowMarkets();
    borrowKitState = { mode: "ready", message: `${data.markets.length} cirBTC/USDC markets returned by Circle's Arc Borrow Kit.`, data, preview: null };
  } catch (error) {
    borrowKitState = { mode: "error", message: error.message ?? "Borrow Kit discovery is unavailable.", data: null, preview: null };
  }
  render();
}

async function loadServerRuntimeStatus({ showProgress = false } = {}) {
  if (serverRuntimeLoading) return;
  serverRuntimeLoading = true;
  if (showProgress) {
    serverRuntime = { ...serverRuntime, mode: serverRuntime.lastCheckedAt ? "refreshing" : "checking", lastError: null };
    render();
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("/api/agent/status", { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Status request failed (${response.status}).`);
    const payload = await response.json();
    serverRuntime = { mode: "ready", configured: payload.configured === true, access: payload.access ?? "public_summary", capabilities: payload.capabilities ?? {}, deployment: payload.deployment ?? null, status: payload.status, runState: payload.runState ?? payload.runAttempt?.state ?? null, runAttempt: payload.runAttempt ?? null, failureHistory: payload.failureHistory ?? [], summaryCounts: payload.summaryCounts ?? null, history: payload.history ?? [], acknowledgment: payload.acknowledgment ?? null, acknowledgments: payload.acknowledgments ?? [], researchSession: payload.researchSession ?? null, researchSessions: payload.researchSessions ?? [], guardianRegistration: payload.guardianRegistration ?? null, guardian: payload.guardian ?? null, guardianHistory: payload.guardianHistory ?? [], interop: payload.interop ?? null, interopHistory: payload.interopHistory ?? [], lastCheckedAt: new Date().toISOString(), lastError: null };
  } catch (error) {
    serverRuntime = { ...serverRuntime, mode: "unavailable", lastCheckedAt: new Date().toISOString(), lastError: error.name === "AbortError" ? "Runtime status request timed out after 10 seconds." : error.message ?? "Runtime status request failed." };
  } finally {
    clearTimeout(timeout);
    serverRuntimeLoading = false;
  }
  render();
}

function scheduleServerRuntimeRefresh() {
  clearInterval(serverRuntimeRefreshTimer);
  serverRuntimeRefreshTimer = setInterval(() => {
    if (shouldRefreshRuntimeStatus({ lastCheckedAt: serverRuntime.lastCheckedAt, visibilityState: document.visibilityState })) loadServerRuntimeStatus();
  }, SERVER_STATUS_REFRESH_MS);
}

document.addEventListener("visibilitychange", () => {
  if (shouldRefreshRuntimeStatus({ lastCheckedAt: serverRuntime.lastCheckedAt, visibilityState: document.visibilityState })) loadServerRuntimeStatus({ showProgress: true });
});

render();
refreshMarkets();
loadEarnKitVaults();
loadOnrampReadiness();
loadBorrowKitMarkets();
loadServerRuntimeStatus();
scheduleServerRuntimeRefresh();
