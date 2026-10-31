import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { fetchGatewayObservation } from "../packages/arc-data/gateway.js";
import { normalizeVaultExposure } from "../packages/arc-data/vault-exposure.js";
import { verifyReceiptDocument } from "../packages/evidence/index.js";

// Deterministic browser acceptance: no real wallet, API key or chain transaction.
const account = `0x${"1".repeat(40)}`;
const vault = `0x${"2".repeat(40)}`;
const asset = `0x${"3".repeat(40)}`;
const contract = `0x${"4".repeat(40)}`;
const market = `0x${"5".repeat(64)}`;
const recordedAt = "2026-10-30T15:00:00.000Z";
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
    let failGateway = false;
    let failExposure = false;
    let holdGateway = null;
    let gatewayStarted = () => {};
    await context.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      let status = 200;
      let body;
      if (url.pathname === "/api/app-kits/gateway") {
        if (holdGateway) { gatewayStarted(); await holdGateway; }
        status = failGateway ? 502 : 200;
        body = failGateway ? { ok: false } : { ok: true, observation: await gateway(url.searchParams.get("depositor")) };
      } else if (url.pathname === "/api/app-kits/vault-exposure") {
        status = failExposure ? 502 : 200;
        body = failExposure ? { ok: false } : { ok: true, observation: exposure };
      } else if (url.pathname === "/api/app-kits/earn") {
        body = { vaults: [{ vaultAddress: vault, protocol: "MORPHO", name: "Browser fixture vault", asset: "USDC", currentApy: 0.05, liquidity: "1000000", totalDeposits: "2000000", status: "active" }] };
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
