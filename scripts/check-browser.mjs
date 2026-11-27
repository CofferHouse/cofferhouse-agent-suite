import { fetchSolanaTransactionFees, METEORA_DLMM_PROGRAM } from "../packages/arc-data/solana-transaction-fees.js";
import { normalizeMeteoraHistory } from "../packages/arc-data/meteora-history.js";
import { normalizeCoinbaseProduct } from '../packages/arc-data/coinbase.js';
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { fetchGatewayObservation } from "../packages/arc-data/gateway.js";
import { normalizeVaultExposure } from "../packages/arc-data/vault-exposure.js";
import { sealDocument, verifyReceiptDocument } from "../packages/evidence/index.js";
import { normalizeMeteoraPools } from "../packages/arc-data/meteora.js";
import { normalizeMeteoraPosition } from "../packages/arc-data/meteora-position.js";
import { screenLiquidityPools } from "../packages/agent-modules/liquidity-research.js";

// Deterministic browser acceptance: no real wallet, API key or chain transaction.
const account = `0x${"1".repeat(40)}`;
const vault = `0x${"2".repeat(40)}`;
const asset = `0x${"3".repeat(40)}`;
const contract = `0x${"4".repeat(40)}`;
const market = `0x${"5".repeat(64)}`;
const recordedAt = "2026-10-30T15:00:00.000Z";
const positionTarget={pool:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",user:"11111111111111111111111111111111",position:"So11111111111111111111111111111111111111112"};
const historySignature="1".repeat(64);
const historyFixture=normalizeMeteoraHistory({events:[
  {eventType:"add",ixIndex:0,amountXUsd:"50",amountYUsd:"50",totalUsd:"100"},
  {eventType:"remove",ixIndex:1,amountXUsd:"45",amountYUsd:"45",totalUsd:"90"},
  {eventType:"claim_fee",ixIndex:2,amountXUsd:"5",amountYUsd:"10",totalUsd:"15"}
].map(e=>({...e,signature:historySignature,positionAddress:positionTarget.position,poolAddress:positionTarget.pool,userAddress:positionTarget.user,tokenX:positionTarget.position,tokenY:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",blockTime:Math.floor(Date.parse(recordedAt)/1000),slot:100,createdAt:recordedAt,amountX:"1",amountY:"1"}))},positionTarget,recordedAt);
const positionFixture=normalizeMeteoraPosition({positionAddress:positionTarget.position,isClosed:false,lowerBinId:10,upperBinId:20,poolActiveBinId:21,isOutOfRange:true,pnlUsd:"-3.00",allTimeFees:{total:{usd:"12.25"}},unrealizedPnl:{balanceTokenX:{amount:"1",usd:"120"},balanceTokenY:{amount:"20",usd:"20"},unclaimedFeeTokenX:{amount:"0.1",usd:"12"},unclaimedFeeTokenY:{amount:"1",usd:"1"}}},{tokenX:positionTarget.position,tokenY:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},positionTarget,recordedAt);
const networkFeeFixture=await fetchSolanaTransactionFees({target:positionTarget,transactions:[{signature:historySignature,slot:100,blockTime:Math.floor(Date.parse(recordedAt)/1000)}],historyReceiptId:"fixture"},{fetcher:async()=>({ok:true,json:async()=>({jsonrpc:"2.0",id:historySignature,result:{version:0,slot:100,blockTime:Math.floor(Date.parse(recordedAt)/1000),meta:{err:null,fee:5000,innerInstructions:[]},transaction:{signatures:[historySignature],message:{accountKeys:[{pubkey:positionTarget.user,signer:true,writable:true},...[positionTarget.pool,positionTarget.position,METEORA_DLMM_PROGRAM].map(pubkey=>({pubkey,signer:false,writable:true}))],instructions:[{programId:METEORA_DLMM_PROGRAM,accounts:[positionTarget.pool,positionTarget.position]}]}}}})})});
const identity = { chain_id: 5042, last_indexed_block: "123" };
const exposure = normalizeVaultExposure({
  config: { ...identity, address: vault, version: "1.0", asset: { address: asset, symbol: "USDC", decimals: 6 }, owner: contract, curator: account },
  state: { ...identity, address: vault, total_assets: "100000000", withdrawable_assets: "25000000" },
  allocations: { ...identity, vault_address: vault, allocations: [{ market_id: market, supply_assets: "100000000", supply_cap: "200000000" }] }
}, { vaultAddress: vault, version: 1, observedAt: recordedAt });
const domain = (id, chain) => ({ domain: id, chain, network: "Mainnet", walletContract: { address: contract, supportedTokens: ["USDC", "EURC", "cirBTC"] }, minterContract: { address: contract, supportedTokens: ["USDC", "EURC", "cirBTC"] } });
async function gateway(depositor = null) {
  return fetchGatewayObservation({ depositor }, {
    now: () => recordedAt,
    fetcher: async (url, options) => {
      if (url.endsWith("/info")) return { ok: true, json: async () => ({ domains: [domain(0, "Ethereum"), domain(26, "Arc")] }) };
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ token: body.token, balances: body.sources.map(source => ({ ...source, balance: body.token === "cirBTC" ? "0.00000001" : "1.000000" })) }) };
    }
  });
}

const results = [];
const errors = [];
const artifacts = process.env.BROWSER_QA_ARTIFACT_DIR;
if (artifacts) await mkdir(artifacts, { recursive: true });
const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    await context.addInitScript(({ account }) => {
      let activeAccount = sessionStorage.getItem("qa-wallet-account") ?? account;
      let activeChain = sessionStorage.getItem("qa-wallet-chain") ?? "0x13b2";
      const handlers = new Map();
      window.__qaWalletCalls = [];
      window.ethereum = {
        request: async ({ method }) => {
          window.__qaWalletCalls.push(method);
          if (method === "eth_accounts" || method === "eth_requestAccounts") return activeAccount ? [activeAccount] : [];
          if (method === "eth_chainId") return activeChain;
          throw new Error(`Unexpected wallet method: ${method}`);
        },
        on(event, callback) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(callback); },
        removeListener(event, callback) { handlers.get(event)?.delete(callback); }
      };
      const emit = (event, payload) => { for (const callback of handlers.get(event) ?? []) callback(payload); };
      window.__qaChangeAccount = next => { activeAccount = next; sessionStorage.setItem("qa-wallet-account", next ?? ""); emit("accountsChanged", next ? [next] : []); };
      window.__qaChangeChain = next => { activeChain = next; sessionStorage.setItem("qa-wallet-chain", next); emit("chainChanged", next); };
      window.__qaDisconnect = () => window.__qaChangeAccount(null);
      window.__qaProviderDisconnect = () => { activeAccount = null; sessionStorage.setItem("qa-wallet-account", ""); emit("disconnect", { code: 4900, message: "Browser fixture disconnect" }); };
    }, { account });
    let failCoinbase = false;
    let failGateway = false;
    let failExposure = false;
    let failEarn = false;
    let earnLiquidity = '1000000', earnApy = 0.05, earnStatus = 'active', holdEarn = null, earnStarted = null;
    let earnRequestCount = 0;
    let solanaConfigured = false;
    let failMeteora = false;
    let failMeteoraPosition = false;
    let failMeteoraHistory = false;
    let failNetworkFees = false;
    let holdGateway = null;
    let gatewayStarted = () => {};
    await context.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      let status = 200;
      let body;
      if (url.pathname === "/api/scout/solana-transaction-fees") {
        const input=route.request().postDataJSON();
        assert.deepEqual(input.signatures,[historySignature]);
        assert.equal(verifyReceiptDocument(input.historyReceipt).valid,true);
        if(failNetworkFees){status=502;body={ok:false,error:"Unavailable"};}
        else body={ok:true,observation:{...networkFeeFixture,historyReceiptId:input.historyReceipt.receiptId}};
      } else if (url.pathname === "/api/scout/meteora-history") {
        assert.equal(route.request().method(),"POST");
        assert.deepEqual(route.request().postDataJSON(),positionTarget);
        body={ok:true,history:failMeteoraHistory ? {status:"UNAVAILABLE",target:positionTarget,events:[]}:historyFixture};
      } else if (url.pathname === "/api/scout/meteora-position") {
        assert.equal(route.request().method(),"POST");
        assert.deepEqual(route.request().postDataJSON(),positionTarget);
        body={ok:true,status:failMeteoraPosition ? "UNAVAILABLE":"FOUND",observation:failMeteoraPosition ? null:positionFixture};
      } else if (url.pathname === "/api/scout/meteora") {
        assert.equal(url.searchParams.get("minTvlUsd"),"25000");
        const pools=failMeteora ? [] : normalizeMeteoraPools({current_page:1,data:[{
          address:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",tvl:100000,volume:{"24h":20000},fees:{"24h":100},is_blacklisted:false,
          token_x:{address:"So11111111111111111111111111111111111111112",symbol:"SOL",freeze_authority_disabled:true},
          token_y:{address:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",symbol:"USDC",freeze_authority_disabled:true}
        }]});
        body={ok:true,observation:screenLiquidityPools({status:failMeteora ? "UNAVAILABLE":"FOUND",pools,sampled:failMeteora ? null:1})};
      } else if (url.pathname === "/api/scout/solana") {
        body = solanaConfigured ? {ok:true,configured:true,status:"FOUND",tokens:[{
          asset:{symbol:"USDC",mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},
          lendingMint:"So11111111111111111111111111111111111111112",observedAt:recordedAt,
          providerRates:{supply:"250"},supplyApyPct:null,withdrawableLiquidityUsd:null
        }]} : {ok:true,configured:false,status:"NOT_CONFIGURED",tokens:[]};
      } else if (url.pathname === "/api/scout/discovery") {
        assert.equal(url.searchParams.get("chains"), "4663");
        assert.equal(url.searchParams.get("asset"), "USDG");
        assert.equal(url.searchParams.get("minLiquidityUsd"), "2000");
        assert.equal(url.searchParams.get("maxUtilizationPct"), "50");
        body = {ok:true,networks:[{id:4663,name:"Robinhood Chain",status:"FOUND",scanned:1,observedAt:new Date().toISOString(),markets:[{
          id:"eip155:4663:morpho-blue:" + market,asset:{symbol:"USDG",address:asset},collateral:null,
          supplyApyPct:8,liquidityUsd:2000,utilizationPct:50
        }]}]};
      } else if (url.pathname === '/api/coinbase/market') {
        status = failCoinbase ? 502 : 200;
        const product = url.searchParams.get('product');
        body = failCoinbase ? {ok:false} : {ok:true, observation:normalizeCoinbaseProduct({product_id:product, product_type:'SPOT', base_currency_id:product.split('-')[0],quote_currency_id:product.split('-')[1],price:'80000'},product,new Date().toISOString())};
      } else if (url.pathname === "/api/app-kits/gateway") {
        if (holdGateway) { gatewayStarted(); await holdGateway; }
        status = failGateway ? 502 : 200;
        body = failGateway ? { ok: false } : { ok: true, observation: await gateway(url.searchParams.get("depositor")) };
      } else if (url.pathname === "/api/app-kits/vault-exposure") {
        status = failExposure ? 502 : 200;
        body = failExposure ? { ok: false } : { ok: true, observation: exposure };
      } else if (url.pathname === "/api/app-kits/earn") {
        earnRequestCount += 1;
        if (holdEarn) { earnStarted(); await holdEarn; }
        status = failEarn ? 502 : 200;
        body = failEarn ? { ok: false } : { observedAt: new Date().toISOString(), vaults: [{ vaultAddress: vault, protocol: "MORPHO", name: "Browser fixture vault", asset: "USDC", currentApy: earnApy, liquidity: earnLiquidity, totalDeposits: "2000000", status: earnStatus }] };
      } else if (url.pathname === "/api/agent/status") {
        body = { configured: false, capabilities: {}, history: [] };
      } else {
        body = { configured: false, markets: [], error: "Browser fixture: unavailable service" };
        status = url.pathname.includes("borrow") ? 503 : 200;
      }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    await context.route("https://api.morpho.org/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { markets: { items: [] } } }) }));
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(10_000);
    await page.goto(server.resolvedUrls.local[0]);
    await page.locator(".gateway-refresh").waitFor();
    const meteora=page.locator(".meteora-discovery");
    await meteora.locator('button[type="submit"]').click();
    await meteora.locator("tbody tr").waitFor();
    assert.match(await meteora.locator("tbody tr").innerText(),/SOL \/ USDC/);
    await meteora.locator(".meteora-use-pool").click();
    const positionPanel=page.locator(".meteora-position");
    assert.equal(await positionPanel.locator('input[name="pool"]').inputValue(),positionTarget.pool);
    await positionPanel.locator('input[name="user"]').fill(positionTarget.user);
    await positionPanel.locator('input[name="position"]').fill(positionTarget.position);
    await positionPanel.locator('button[type="submit"]').click();
    await positionPanel.getByText("Price is outside the position range; review required",{exact:true}).waitFor();
    const positionDownload=page.waitForEvent("download");
    await positionPanel.locator(".meteora-position-download").click();
    const positionReceipt=JSON.parse(await readFile(await (await positionDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(positionReceipt).valid,true);
    assert.equal(positionReceipt.observation.providerPnlUsd,"-3.00");
    assert.equal(positionReceipt.observation.costAdjustedPnlUsd,null);
    assert.equal(positionReceipt.observation.rangeNeedsReview,true);
    const comparisonPanel=page.locator(".meteora-comparison");
    const earlierObservation={...positionReceipt.observation,observedAt:"2026-10-29T15:00:00.000Z",providerPnlUsd:"-8.00",providerAllTimeFeesUsd:"10.00"};
    const earlierReceipt=sealDocument({schema:"cofferhouse.meteora.position-receipt.v1",generatedAt:earlierObservation.observedAt,observation:earlierObservation},"meteora-position");
    await comparisonPanel.locator(".meteora-baseline-file").setInputFiles({name:"previous-position.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(earlierReceipt))});
    await comparisonPanel.locator(".meteora-comparison-download").waitFor();
    const comparisonDownload=page.waitForEvent("download");
    await comparisonPanel.locator(".meteora-comparison-download").click();
    const compared=JSON.parse(await readFile(await (await comparisonDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(compared).valid,true);
    assert.equal(compared.comparison.providerChangesUsd.providerPnlUsd,"5");
    assert.equal(compared.comparison.providerChangesUsd.providerAllTimeFeesUsd,"2.25");
    assert.equal(compared.comparison.netReturnPct,null);
    assert.equal(compared.comparison.beforeReceiptId,earlierReceipt.receiptId);
    assert.equal(compared.comparison.afterReceiptId,positionReceipt.receiptId);
    await comparisonPanel.locator(".meteora-baseline-file").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({...earlierReceipt,observation:{...earlierObservation,providerPnlUsd:"100"}}))});
    await comparisonPanel.getByText("Invalid position receipt. Check its integrity, identities and required data.",{exact:true}).waitFor();
    assert.equal(await comparisonPanel.locator(".meteora-comparison-download").count(),0);
    await comparisonPanel.locator(".meteora-baseline-file").setInputFiles({name:"previous-position.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(earlierReceipt))});
    await comparisonPanel.locator(".meteora-comparison-download").waitFor();
    const historyPanel=page.locator(".meteora-history");
    await historyPanel.locator(".meteora-history-load").click();
    await historyPanel.locator(".meteora-history-download").waitFor();
    await historyPanel.getByText("Some observed transactions have no cost entry; an adjusted balance is not shown.",{exact:true}).waitFor();
    const historyDownload=page.waitForEvent("download");
    await historyPanel.locator(".meteora-history-download").click();
    const historyReceipt=JSON.parse(await readFile(await (await historyDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(historyReceipt).valid,true);
    assert.equal(historyReceipt.history.events.length,3);
    await historyPanel.locator('.solana-fee-form button[type="submit"]').click();
    await historyPanel.locator(".solana-fee-download").waitFor();
    assert.match(await historyPanel.locator(".solana-fee-results").innerText(),/0.000005/);
    const networkDownload=page.waitForEvent("download");
    await historyPanel.locator(".solana-fee-download").click();
    const networkReceipt=JSON.parse(await readFile(await (await networkDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(networkReceipt).valid,true);
    assert.equal(networkReceipt.historyReceipt.receiptId,historyReceipt.receiptId);
    assert.equal(networkReceipt.observation.transactions[0].feeLamports,"5000");
    assert.equal(networkReceipt.observation.transactions[0].allocatedPositionCostUsd,null);
    assert.equal(await historyPanel.locator(".meteora-cost-form input").inputValue(),"");
    failNetworkFees=true;
    await historyPanel.locator('.solana-fee-form button[type="submit"]').click();
    await historyPanel.getByText("Network fees could not be read. Try again later.",{exact:true}).waitFor();
    assert.equal(await historyPanel.locator(".solana-fee-download").count(),0);
    await historyPanel.locator(".meteora-cost-form summary").click();
    await historyPanel.locator(".meteora-cost-form input").fill("0.5");
    assert.equal(await historyPanel.locator(".meteora-cashflow-download").count(),0);
    await historyPanel.locator('.meteora-cost-form button[type="submit"]').click();
    await historyPanel.getByText("Costs were entered for all observed transactions; they are not independently verified.",{exact:true}).waitFor();
    const cashflowDownload=page.waitForEvent("download");
    await historyPanel.locator(".meteora-cashflow-download").click();
    const cashflowReceipt=JSON.parse(await readFile(await (await cashflowDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(cashflowReceipt).valid,true);
    assert.equal(cashflowReceipt.historyReceipt.receiptId,historyReceipt.receiptId);
    assert.equal(cashflowReceipt.cashflows.transactionCount,1);
    assert.equal(cashflowReceipt.cashflows.indexedCashflowBalanceUsd,"5");
    assert.equal(cashflowReceipt.cashflows.indexedBalanceAfterEnteredCostsUsd,"4.5");
    assert.equal(cashflowReceipt.cashflows.realizedProfitUsd,null);
    assert.equal(cashflowReceipt.positionReceipt.receiptId,positionReceipt.receiptId);
    assert.equal(cashflowReceipt.cashflows.positionValue.positionReceiptId,positionReceipt.receiptId);
    assert.equal(cashflowReceipt.cashflows.positionValue.providerBalanceComponentsUsd.total,"140");
    assert.equal(cashflowReceipt.cashflows.positionValue.providerPendingFeeComponentsUsd.total,"13");
    assert.equal(cashflowReceipt.cashflows.positionValue.balanceOnlyReferenceUsd,"145");
    assert.equal(cashflowReceipt.cashflows.positionValue.balanceOnlyReferenceAfterEnteredCostsUsd,"144.5");
    assert.equal(cashflowReceipt.cashflows.positionValue.pendingFeesAdded,false);
    assert.equal(cashflowReceipt.cashflows.positionValue.valuationVerified,false);
    assert.equal(cashflowReceipt.cashflows.positionValue.realizedProfitUsd,null);
    await historyPanel.locator(".meteora-cost-form summary").click();
    await historyPanel.locator(".meteora-cost-form input").fill("-1");
    assert.equal(await historyPanel.locator(".meteora-cashflow-download").count(),0);
    await historyPanel.locator('.meteora-cost-form button[type="submit"]').click();
    await historyPanel.getByText("Check the transaction costs. Use nonnegative USD decimal values.",{exact:true}).waitFor();
    assert.equal(await historyPanel.locator(".meteora-cashflow-download").count(),0);
    failMeteoraHistory=true;
    await historyPanel.locator(".meteora-history-load").click();
    await historyPanel.getByText("Position history is unavailable.",{exact:true}).waitFor();
    assert.equal(await historyPanel.locator(".meteora-history-download").count(),0);
    assert.equal(await historyPanel.locator(".meteora-cashflow-download").count(),0);
    failMeteoraPosition=true;
    await positionPanel.locator('button[type="submit"]').click();
    await positionPanel.getByText("Position data is unavailable.",{exact:true}).waitFor();
    assert.equal(await positionPanel.locator(".meteora-position-download").count(),0);
    assert.equal(await comparisonPanel.locator(".meteora-comparison-download").count(),0);
    await comparisonPanel.locator(".meteora-clear-baseline").click();
    const meteoraDownload=page.waitForEvent("download");
    await meteora.locator(".meteora-download").click();
    const meteoraReceipt=JSON.parse(await readFile(await (await meteoraDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(meteoraReceipt).valid,true);
    assert.equal(meteoraReceipt.observation.candidates[0].positionPnlUsd,null);
    assert.equal(meteoraReceipt.observation.execution.enabled,false);
    failMeteora=true;
    await meteora.locator('button[type="submit"]').click();
    await meteora.getByText("Meteora data is unavailable. No pool recommendation was produced.",{exact:true}).waitFor();
    assert.equal(await meteora.locator(".meteora-download").count(),0);
    await page.locator(".solana-refresh").click();
    await page.getByText("Jupiter data access is not configured.", {exact:true}).waitFor();
    assert.equal(await page.locator(".solana-download").count(),0);
    solanaConfigured = true;
    await page.locator(".solana-refresh").click();
    const solanaDownload = page.waitForEvent("download");
    await page.locator(".solana-download").click();
    const solanaReceipt = JSON.parse(await readFile(await (await solanaDownload).path(), "utf8"));
    assert.equal(verifyReceiptDocument(solanaReceipt).valid,true);
    assert.equal(solanaReceipt.network,"Solana mainnet");
    assert.equal(solanaReceipt.tokens[0].providerRates.supply,"250");
    assert.equal(solanaReceipt.tokens[0].supplyApyPct,null);
    const scout = page.locator(".scout-discovery");
    await scout.locator('input[value="5042"]').uncheck();
    await scout.locator('input[value="8453"]').uncheck();
    await scout.locator('input[value="1"]').uncheck();
    await scout.locator('input[value="4663"]').check();
    await scout.locator('input[name="asset"]').fill("USDG");
    await scout.locator('input[name="minLiquidityUsd"]').fill("2000");
    await scout.locator('input[name="maxUtilizationPct"]').fill("50");
    await scout.locator('button[type="submit"]').click();
    await scout.locator("tbody tr").waitFor();
    assert.match(await scout.locator("tbody tr").innerText(), /USDG.*8%/s);
    assert.match(await scout.locator("details > summary").first().innerText(), /Robinhood Chain/);
    const discoveryDownload = page.waitForEvent("download");
    await scout.locator(".scout-discovery-download").click();
    const discoveryReceipt = JSON.parse(await readFile(await (await discoveryDownload).path(), "utf8"));
    assert.equal(verifyReceiptDocument(discoveryReceipt).valid, true);
    assert.deepEqual(discoveryReceipt.filters, { chains: [4663], asset: "USDG", minLiquidityUsd: "2000", maxUtilizationPct: "50" });
    assert.equal(discoveryReceipt.networks[0].markets[0].id, `eip155:4663:morpho-blue:${market}`);
    discoveryReceipt.networks[0].markets[0].supplyApyPct = 99;
    assert.equal(verifyReceiptDocument(discoveryReceipt).valid, false);
    await page.locator('.coinbase-market-form button').click();
    await page.locator('.coinbase-paper-form').waitFor();
    await page.locator('.coinbase-paper-form button').click();
    assert.match(await page.locator('.coinbase-panel').innerText(), /0.00125 BTC/);
    const coinbaseDownload = page.waitForEvent('download');
    await page.locator('.coinbase-download').click();
    const downloadedCoinbase = await coinbaseDownload;
    const coinbaseReceipt = JSON.parse(await readFile(await downloadedCoinbase.path(), 'utf8'));
    assert.equal(verifyReceiptDocument(coinbaseReceipt).valid, true);
    assert.equal(coinbaseReceipt.preview.execution.submitted, false);
    await page.locator('.coinbase-market-form select').selectOption('ETH-USDC');
    await page.locator('.coinbase-market-form button').click();
    await page.locator('.coinbase-paper-form').waitFor();
    assert.match(await page.locator('.coinbase-panel').innerText(), /80000 USDC/);
    assert.equal(await page.locator('.coinbase-panel').innerText().then(t=>t.includes('0.00125 BTC')), false);
    failCoinbase = true;
    await page.locator('.coinbase-market-form button').click();
    await page.locator('.coinbase-panel [role="status"]').waitFor();
    assert.equal(await page.locator('.coinbase-paper-form').count(), 0);
    assert.equal(await page.locator(".gateway-balances").isDisabled(), true);
    await page.locator(".gateway-refresh").click();
    await page.locator(".gateway-download").waitFor();
    assert.equal(await page.locator(".gateway-assets article").count(), 3);
    assert.match(await page.locator(".gateway-assets").innerText(), /Balance not requested/);
    await page.locator(".holder-connect-wallet").click();
    await page.waitForFunction(() => !document.querySelector(".gateway-balances").disabled);
    await page.locator(".gateway-balances").click();
    await page.waitForFunction(() => document.querySelector(".gateway-panel")?.textContent.includes("2.000000 USDC"));
    assert.match(await page.locator(".gateway-assets").innerText(), /0\.00000002 cirBTC/);
    const gatewayDownload = page.waitForEvent("download");
    await page.locator(".gateway-download").click();
    const receipt = JSON.parse(await readFile(await (await gatewayDownload).path(), "utf8"));
    assert.equal(verifyReceiptDocument(receipt).valid, true);
    assert.equal(receipt.observation.depositor, account);
    for (const [language, locale] of [["zh", "zh-CN"], ["ja", "ja"], ["hi", "hi"], ["es", "es"], ["en", "en"]]) {
      await page.locator("#holder-language").selectOption(language);
      await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      if (language !== "en") assert.notEqual(await page.locator(".gateway-refresh").innerText(), "CHECK NETWORK SUPPORT");
      assert.match(await page.locator(".gateway-assets").innerText(), /0\.00000002 cirBTC/);
    }
    failGateway = true;
    await page.locator(".gateway-refresh").click();
    await page.waitForFunction(() => document.querySelector(".gateway-panel")?.textContent.includes("Gateway is unavailable"));
    assert.equal(await page.locator(".gateway-download").count(), 0);
    failGateway = false;
    await page.locator(".gateway-balances").click();
    await page.locator(".gateway-download").waitFor();
    if (artifacts) await page.screenshot({ path: join(artifacts, `holder-${viewport.width}.png`), fullPage: true });
    let release;
    holdGateway = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { gatewayStarted = resolve; });
    const reloaded = page.waitForEvent("domcontentloaded");
    await page.locator(".gateway-balances").click();
    await started;
    await page.evaluate(() => window.__qaDisconnect());
    release(); holdGateway = null;
    await reloaded;
    await page.locator(".gateway-refresh").waitFor();
    assert.equal(await page.locator(".gateway-download").count(), 0);
    assert.equal(await page.locator(".gateway-balances").isDisabled(), true);
    assert.equal(await page.locator(".holder-connection code").count(), 0);
    // Both account switches and network changes require a fresh explicit connection.
    const nextAccount = `0x${"6".repeat(40)}`;
    await page.evaluate(next => window.__qaChangeAccount(next), nextAccount);
    await page.locator(".holder-connect-wallet").click();
    await page.waitForFunction(() => Boolean(document.querySelector(".holder-connection code")));
    assert.equal(await page.locator(".holder-connection code").getAttribute("title"), nextAccount);
    const changedNetwork = page.waitForEvent("domcontentloaded");
    await page.evaluate(() => window.__qaChangeChain("0x1"));
    await changedNetwork;
    await page.locator(".holder-connect-wallet").waitFor();
    assert.equal(await page.locator(".holder-connection code").count(), 0);
    assert.equal(await page.locator(".gateway-balances").isDisabled(), true);
    await page.locator(".holder-connect-wallet").click();
    await page.waitForFunction(() => document.querySelector(".holder-connection")?.textContent.includes("WRONG NETWORK"));
    const restoredNetwork = page.waitForEvent("domcontentloaded");
    await page.evaluate(() => window.__qaChangeChain("0x13b2"));
    await restoredNetwork;
    await page.locator(".holder-connect-wallet").click();
    await page.waitForFunction(() => Boolean(document.querySelector(".holder-connection code")));
    const disconnected = page.waitForEvent("domcontentloaded");
    await page.evaluate(() => window.__qaProviderDisconnect());
    await disconnected;
    await page.locator(".gateway-refresh").waitFor();
    assert.equal(await page.locator(".holder-connection code").count(), 0);
    assert.equal(await page.locator(".gateway-balances").isDisabled(), true);
    await page.locator('.suite-tab[data-view="hub"]').click();
    await page.locator('.suite-tab[data-view="strategy"]').click();

    await page.locator('#holder-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    const idle = page.locator('.idle-capital-panel');
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    assert.equal(await idle.locator('input[name="walletUsdc"]').inputValue(), '');
    await idle.locator('.idle-capital-record-time').click();
    assert.match(await idle.locator('input[name="observedAt"]').inputValue(), /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
    await idle.locator('.idle-capital-example').click();
    assert.equal(await idle.locator('input[name="withdrawalTermsReviewed"]').isChecked(), false);
    await idle.locator('button[type="submit"]').click();
    assert.equal(await idle.locator('.idle-capital-result h4').innerText(), 'Keep funds liquid');
    await idle.locator('input[name="withdrawalTermsReviewed"]').check();
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    await idle.locator('button[type="submit"]').click();
    await idle.locator('.idle-capital-download').waitFor();
    const idleDownload = page.waitForEvent('download');
    await idle.locator('.idle-capital-download').click();
    const idleReceipt = JSON.parse(await readFile(await (await idleDownload).path(), 'utf8'));
    assert.equal(verifyReceiptDocument(idleReceipt).valid, true);
    assert.equal(idleReceipt.inputSource, 'EDITABLE_SYNTHETIC_EXAMPLE');
    assert.equal(idleReceipt.scenario.decision, 'REVIEW_REQUIRED');
    assert.equal(idleReceipt.scenario.reviewableAllocationUsdc, '4000.000000');
    assert.equal(idleReceipt.scenario.netScenarioAfterEnteredCostsUsdc, '3.931506');
    assert.equal(idleReceipt.scenario.execution.submitted, false);
    await idle.locator('.idle-capital-save-a').click();
    assert.equal(await idle.locator('.idle-comparison-download').count(), 0);
    await idle.locator('input[name="entryCostUsdc"]').fill('10');
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    assert.equal(await idle.locator('.idle-capital-result').count(), 0);
    await idle.locator('button[type="submit"]').click();
    assert.match(await idle.locator('.idle-capital-result').innerText(), /does not clear entered costs/);
    const blockedDownload = page.waitForEvent('download');
    await idle.locator('.idle-capital-download').click();
    const blockedReceipt = JSON.parse(await readFile(await (await blockedDownload).path(), 'utf8'));
    assert.equal(blockedReceipt.scenario.reviewableAllocationUsdc, '0.000000');
    assert.equal(blockedReceipt.scenario.decision, 'KEEP_LIQUID');
    assert.equal(verifyReceiptDocument(blockedReceipt).valid, true);
    await idle.locator('.idle-capital-save-b').click();
    const idleComparisonDownload = page.waitForEvent('download');
    await idle.locator('.idle-comparison-download').click();
    const idleComparisonReceipt = JSON.parse(await readFile(await (await idleComparisonDownload).path(), 'utf8'));
    assert.equal(verifyReceiptDocument(idleComparisonReceipt).valid, true);
    assert.equal(idleComparisonReceipt.snapshots.a.receiptId, idleReceipt.receiptId);
    assert.equal(idleComparisonReceipt.snapshots.b.receiptId, blockedReceipt.receiptId);
    assert.equal(idleComparisonReceipt.comparison.rows.find(row => row.id === 'net').deltaBMinusAUsdc, '-9.500000');
    assert.equal(idleComparisonReceipt.comparison.decisionsAtCapture.b, 'KEEP_LIQUID');
    for (const [language, locale] of [['zh','zh-CN'],['ja','ja'],['hi','hi'],['es','es']]) {
      await page.locator('#holder-language').selectOption(language);
      await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      assert.notEqual(await idle.locator('#idle-capital-title').innerText(), 'USDC planning between commitments');
      assert.notEqual(await idle.locator('.idle-capital-download').innerText(), 'DOWNLOAD USDC SCENARIO');
      assert.notEqual(await idle.locator('#idle-comparison-title').innerText(), 'Saved USDC scenarios');
      assert.notEqual(await idle.locator('.idle-comparison-download').innerText(), 'DOWNLOAD SCENARIO COMPARISON');
      assert.match(await idle.locator('.idle-comparison').innerText(), /-9.500000/);
      assert.match(await idle.locator('.idle-capital-result').innerText(), /4000.000000 USDC/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Idle planner overflows horizontally');
    }
    if (artifacts) await page.screenshot({ path: join(artifacts, 'idle-capital-' + viewport.width + '.png'), fullPage: true });
    await page.locator('#holder-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await idle.locator('input[name="holdingHours"]').fill('241');
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    assert.equal(await idle.locator('.idle-comparison-download').count(), 1);
    await idle.locator('button[type="submit"]').click();
    await idle.locator('.idle-capital-save-b').click();
    assert.match(await idle.locator('.idle-comparison-summary').innerText(), /not comparable/);
    const mismatchDownload = page.waitForEvent('download');
    await idle.locator('.idle-comparison-download').click();
    const mismatchReceipt = JSON.parse(await readFile(await (await mismatchDownload).path(), 'utf8'));
    assert.equal(mismatchReceipt.snapshots.a.receiptId, idleReceipt.receiptId);
    assert.ok(mismatchReceipt.comparison.issues.includes('DIFFERENT_HOLDING_WINDOW'));
    assert.ok(mismatchReceipt.comparison.rows.every(row => row.deltaBMinusAUsdc === null));
    assert.equal(verifyReceiptDocument(mismatchReceipt).valid, true);
    await idle.locator('.idle-comparison-clear').click();
    assert.equal(await idle.locator('.idle-comparison-download').count(), 0);
    assert.equal(await idle.locator('.idle-capital-download').count(), 1);
    await idle.locator('.idle-capital-save-a').click();
    await idle.locator('.idle-capital-clear').click();
    assert.equal(await idle.locator('input[name="walletUsdc"]').inputValue(), '');
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    assert.equal(await idle.locator('input[name="withdrawalTermsReviewed"]').isChecked(), false);
    assert.equal(await idle.locator('.idle-comparison-clear').count(), 0);

    // Original receipt files restore saved history after a page reload, never the live form.
    await page.reload();
    await page.locator('.suite-tab[data-view="strategy"]').click();
    await idle.locator('.idle-capital-import:not([disabled])').waitFor();
    assert.equal(await idle.locator('input[name="walletUsdc"]').inputValue(), '');
    const earnReadsBeforeRestore = earnRequestCount;
    await idle.locator('.idle-scenario-import[data-slot="a"]').setInputFiles({name:'scenario-a.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(idleReceipt))});
    await page.waitForFunction(() => document.querySelector('.idle-scenario-import-status[data-slot="a"]')?.textContent.includes('Historical scenario loaded'));
    await idle.locator('.idle-scenario-import[data-slot="b"]').setInputFiles({name:'scenario-b.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(blockedReceipt))});
    await idle.locator('.idle-comparison-download').waitFor();
    const restoredPairDownload = page.waitForEvent('download');
    await idle.locator('.idle-comparison-download').click();
    const restoredPair = JSON.parse(await readFile(await (await restoredPairDownload).path(),'utf8'));
    assert.equal(restoredPair.snapshots.a.receiptId,idleReceipt.receiptId);
    assert.equal(restoredPair.snapshots.a.generatedAt,idleReceipt.generatedAt);
    assert.equal(restoredPair.snapshots.b.receiptId,blockedReceipt.receiptId);
    assert.equal(verifyReceiptDocument(restoredPair).valid,true);
    assert.equal(await idle.locator('input[name="walletUsdc"]').inputValue(),'');
    assert.equal(earnRequestCount,earnReadsBeforeRestore);
    const badArchive=structuredClone(idleReceipt);badArchive.scenario.protectedUsdc='0';
    for(const payload of [Buffer.from(JSON.stringify(badArchive)),Buffer.from(JSON.stringify(restoredPair)),Buffer.alloc(64001,32)]) {
      await idle.locator('.idle-scenario-import[data-slot="a"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:payload});
      await page.waitForFunction(() => document.querySelector('.idle-scenario-import-status[data-slot="a"]')?.textContent.includes('Scenario file rejected'));
      assert.equal(await idle.locator('.idle-comparison-slots code').first().textContent(),idleReceipt.receiptId);
      assert.equal(await idle.locator('.idle-comparison-download').count(),1);
    }
    for(const [language,locale] of [['zh','zh-CN'],['ja','ja'],['hi','hi'],['es','es']]) {
      await page.locator('#holder-language').selectOption(language);
      await page.waitForFunction(locale=>document.documentElement.lang===locale,locale);
      assert.notEqual(await idle.locator('.idle-scenario-imports label').first().innerText(),'OPEN SCENARIO A');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    }
    await page.locator('#holder-language').selectOption('en');
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    await page.evaluate(()=>{
      window.__qaOriginalScenarioRead=File.prototype.arrayBuffer;
      File.prototype.arrayBuffer=function(){
        if(this.name==='delayed-scenario.json') return new Promise(resolve=>{window.__qaReleaseScenarioRead=()=>window.__qaOriginalScenarioRead.call(this).then(resolve);});
        return window.__qaOriginalScenarioRead.call(this);
      };
    });
    await idle.locator('.idle-scenario-import[data-slot="a"]').setInputFiles({name:'delayed-scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(idleReceipt))});
    await page.waitForFunction(()=>typeof window.__qaReleaseScenarioRead==='function');
    await idle.locator('.idle-capital-clear').click();
    await page.evaluate(async()=>{await window.__qaReleaseScenarioRead();File.prototype.arrayBuffer=window.__qaOriginalScenarioRead;await new Promise(requestAnimationFrame);});
    assert.equal(await idle.locator('.idle-comparison-clear').count(),0);
    assert.equal(await idle.locator('.idle-comparison-download').count(),0);
    assert.equal(await idle.locator('input[name="walletUsdc"]').inputValue(),'');

    // Imported liquidity is source-bound; cash and the simple rate remain user assumptions.
    await idle.locator('.idle-capital-example').click();
    await idle.locator('input[name="scenarioAnnualSimpleRatePct"]').fill('3');
    await idle.locator('.idle-capital-vault').selectOption(vault);
    await idle.locator('.idle-capital-import').click();
    assert.equal(await idle.locator('input[name="withdrawalTermsReviewed"]').isChecked(), false);
    assert.equal(await idle.locator('input[name="vaultAvailableLiquidityUsdc"]').inputValue(), '1000000');
    assert.equal(await idle.locator('input[name="vaultAvailableLiquidityUsdc"]').getAttribute('readonly'), '');
    assert.equal(await idle.locator('input[name="scenarioAnnualSimpleRatePct"]').inputValue(), '3');
    await idle.locator('input[name="withdrawalTermsReviewed"]').check();
    await idle.locator('button[type="submit"]').click();
    const earnIdleDownload = page.waitForEvent('download');
    await idle.locator('.idle-capital-download').click();
    const earnIdleReceipt = JSON.parse(await readFile(await (await earnIdleDownload).path(), 'utf8'));
    assert.equal(verifyReceiptDocument(earnIdleReceipt).valid, true);
    assert.equal(earnIdleReceipt.inputSource, 'EARN_LIQUIDITY_WITH_EDITABLE_SYNTHETIC_CASH');
    assert.equal(earnIdleReceipt.scenario.marketSource.vaultAddress, vault);
    assert.equal(earnIdleReceipt.scenario.marketSource.amountUsdc, '1000000');
    assert.equal(earnIdleReceipt.scenario.marketSource.reportedApyPct, 5);
    assert.equal(earnIdleReceipt.scenario.assumptions.scenarioAnnualSimpleRateBps, 300);
    await idle.locator('.idle-capital-save-a').click();
    earnLiquidity = '30000'; earnApy = 0.02; earnStatus = 'paused';
    await idle.locator('.idle-source-review-run').click();
    await idle.locator('.idle-source-review-download').waitFor();
    const sourceReviewDownload = page.waitForEvent('download');
    await idle.locator('.idle-source-review-download').click();
    const sourceReviewReceipt = JSON.parse(await readFile(await (await sourceReviewDownload).path(), 'utf8'));
    assert.equal(verifyReceiptDocument(sourceReviewReceipt).valid, true);
    assert.equal(sourceReviewReceipt.snapshots.a.receiptId, earnIdleReceipt.receiptId);
    assert.equal(sourceReviewReceipt.snapshots.a.scenario.assumptions.scenarioAnnualSimpleRateBps, 300);
    assert.equal(sourceReviewReceipt.reviews[0].status, 'CHANGED');
    assert.equal(sourceReviewReceipt.reviews[0].deltaLiquidityUsdc, '-970000.000000');
    assert.ok(sourceReviewReceipt.reviews[0].issues.includes('VAULT_NOT_ACTIVE'));
    assert.ok(sourceReviewReceipt.reviews[0].issues.includes('CAPTURED_SIZE_EXCEEDS_SHARE'));
    await idle.locator('.idle-source-review-open-guardian').click();
    const earnGuardian = page.locator('.guardian-earn-panel');
    await earnGuardian.locator('.guardian-earn-download').waitFor();
    assert.match(await earnGuardian.locator('.guardian-earn-target h4').first().innerText(), /Priority: high/);
    const signalsDownload = page.waitForEvent('download');
    await earnGuardian.locator('.guardian-earn-download').click();
    const earnSignals = JSON.parse(await readFile(await (await signalsDownload).path(), 'utf8'));
    assert.equal(verifyReceiptDocument(earnSignals).valid,true);
    assert.equal(earnSignals.signals.sourceReviewReceiptId,sourceReviewReceipt.receiptId);
    assert.equal(earnSignals.signals.liveWatchRegistered,false);
    assert.equal(earnSignals.signals.delivery.sent,false);
    assert.deepEqual(earnSignals.signals.execution,{prepared:false,signed:false,submitted:false});
    await earnGuardian.locator('input[name="liquidityDropPct"]').fill('90.25');
    assert.equal(await earnGuardian.locator('.guardian-earn-download').count(),0);
    await earnGuardian.locator('button[type="submit"]').click();
    await earnGuardian.locator('.guardian-earn-download').waitFor();
    for(const [language,locale] of [['zh','zh-CN'],['ja','ja'],['hi','hi'],['es','es']]) {
      await page.locator('#holder-language').selectOption(language);
      await page.waitForFunction(locale=>document.documentElement.lang===locale,locale);
      assert.notEqual(await earnGuardian.locator('h3').innerText(),'Guardian · Earn review attention');
      assert.notEqual(await earnGuardian.locator('.guardian-earn-download').innerText(),'DOWNLOAD GUARDIAN EARN SIGNALS');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    }
    await page.locator('#holder-language').selectOption('en');
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    await earnGuardian.locator('.guardian-earn-open-strategy').click();

    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    earnLiquidity = '1000000'; earnApy = 0.05; earnStatus = 'active';
    for (const [language, locale] of [['zh','zh-CN'],['ja','ja'],['hi','hi'],['es','es']]) {
      await page.locator('#holder-language').selectOption(language);
      await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      assert.notEqual(await idle.locator('.idle-capital-refresh-earn').innerText(), 'REFRESH EARN SOURCES');
      assert.notEqual(await idle.locator('.idle-capital-manual').innerText(), 'USE MANUAL LIQUIDITY');
      assert.notEqual(await idle.locator('.idle-source-review-download').innerText(), 'DOWNLOAD EARN SOURCE REVIEW');
      assert.match(await idle.locator('.idle-capital-source-card').innerText(), /1000000 USDC/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    }
    if (artifacts) await idle.screenshot({ path: join(artifacts, 'idle-earn-' + viewport.width + '.png') });
    await page.locator('#holder-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await idle.locator('.idle-capital-refresh-earn').click();
    await idle.locator('.idle-capital-import:not([disabled])').waitFor();
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    assert.match(await idle.locator('.idle-capital-source-card').innerText(), /Refresh and import/);
    await idle.locator('.idle-capital-vault').selectOption(vault);
    await idle.locator('.idle-capital-import').click();
    await idle.locator('input[name="withdrawalTermsReviewed"]').check();
    await idle.locator('button[type="submit"]').click();
    assert.equal(await idle.locator('.idle-capital-download').count(), 1);
    failEarn = true;
    await idle.locator('.idle-capital-refresh-earn').click();
    await page.waitForFunction(() => document.querySelector('.earn-kit-panel.error') !== null);
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    await idle.locator('.idle-source-review-run').click();
    await idle.locator('.idle-source-review-download').waitFor();
    assert.match(await idle.locator('.idle-source-review').innerText(), /Current Earn evidence is unavailable/);
    await idle.locator('.idle-source-review-open-guardian').click();
    assert.match(await earnGuardian.locator('.guardian-earn-target h4').first().innerText(),/Priority: evidence needed/);
    assert.ok(!(await earnGuardian.innerText()).includes('Priority: high'));
    await earnGuardian.locator('.guardian-earn-open-strategy').click();

    await idle.locator('button[type="submit"]').click();
    assert.match(await idle.locator('.idle-capital-result').innerText(), /Earn source is unavailable/);
    await idle.locator('.idle-capital-manual').click();
    assert.equal(await idle.locator('input[name="vaultAvailableLiquidityUsdc"]').getAttribute('readonly'), null);
    assert.equal(await idle.locator('.idle-capital-download').count(), 0);
    failEarn = false;
    await idle.locator('.idle-capital-refresh-earn').click();
    await idle.locator('.idle-capital-import:not([disabled])').waitFor();
    let releaseEarn;
    holdEarn = new Promise(resolve => { releaseEarn = resolve; });
    const earnReviewStarted = new Promise(resolve => { earnStarted = resolve; });
    await idle.locator('.idle-source-review-run').click();
    await earnReviewStarted;
    await idle.locator('.idle-comparison-clear').click();
    releaseEarn(); holdEarn = null;
    await idle.locator('.idle-capital-import:not([disabled])').waitFor();
    assert.equal(await idle.locator('.idle-source-review-download').count(), 0);
    assert.equal(await idle.locator('.idle-source-review-run').count(), 0);
    await idle.locator('.idle-capital-clear').click();

    const lp=page.locator(".lp-scenario");
    await lp.locator('input[name="principalUsd"]').fill("960");
    await lp.locator('input[name="positionFeesUsd"]').fill("100");
    await lp.locator('input[name="costsUsd"]').fill("20");
    await lp.locator('input[name="holdingValueUsd"]').fill("1050");
    await lp.locator('button[type="submit"]').click();
    await lp.locator(".lp-scenario-result").waitFor();
    const lpDownload=page.waitForEvent("download");
    await lp.locator(".lp-scenario-download").click();
    const lpReceipt=JSON.parse(await readFile(await (await lpDownload).path(),"utf8"));
    assert.equal(verifyReceiptDocument(lpReceipt).valid,true);
    assert.equal(lpReceipt.scenario.netPnlUsd,40);
    assert.equal(lpReceipt.scenario.versusHoldingUsd,-10);
    assert.equal(lpReceipt.scenario.decision,"OUTSIDE_PAPER_LIMITS");
    await page.locator('.suite-tab[data-view="opportunity"]').click();
    await page.locator(".inspect-vault").click();
    await page.locator(".vault-exposure-download").waitFor();
    assert.match(await page.locator(".vault-exposure-panel").innerText(), /100\.000000 USDC/);
    const vaultDownload = page.waitForEvent("download");
    await page.locator(".vault-exposure-download").click();
    assert.equal(verifyReceiptDocument(JSON.parse(await readFile(await (await vaultDownload).path(), "utf8"))).valid, true);
    for (const [language, locale] of [["zh", "zh-CN"], ["ja", "ja"], ["hi", "hi"], ["es", "es"]]) {
      await page.locator("#holder-language").selectOption(language);
      await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      assert.notEqual(await page.locator(".vault-exposure-download").innerText(), "DOWNLOAD VAULT EVIDENCE");
      assert.match(await page.locator(".vault-exposure-panel").innerText(), /100\.000000 USDC/);
    }
    assert.match(await page.locator(".vault-exposure-panel").innerText(), /Activos totales/);
    if (artifacts) await page.screenshot({ path: join(artifacts, `morpho-${viewport.width}.png`), fullPage: true });
    failExposure = true;
    await page.locator(".inspect-vault").click();
    await page.waitForFunction(() => document.querySelector(".vault-exposure-panel")?.textContent.includes("no están disponibles"));
    assert.equal(await page.locator(".vault-exposure-download").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Page overflows horizontally");
    const walletCalls = await page.evaluate(() => window.__qaWalletCalls);
    assert.ok(walletCalls.every(method => ["eth_accounts", "eth_requestAccounts", "eth_chainId"].includes(method)));
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === "es");
    assert.equal(await page.locator("#holder-language").inputValue(), "es");
    results.push({ viewport, gateway: "PASS", vaultExposure: "PASS", languages: 5, languagePersistence: "PASS", evidenceDownloads: "PASS", unavailableSources: "PASS", walletChangeDuringRequest: "PASS", walletAccountNetworkDisconnect: "PASS", horizontalOverflow: false });
    await context.close();
  }
  assert.deepEqual(errors, [], "Unexpected browser exceptions");
  const report = { kind: "MOCKED_BROWSER_ACCEPTANCE", checkedAt: new Date().toISOString(), browser: await browser.version(), results, pageErrors: errors, limitations: ["Backend responses and wallet provider are simulated.", "No real-wallet, deployed-site or financial execution validation is claimed."] };
  if (artifacts) await writeFile(join(artifacts, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}

