import test from "node:test";
import assert from "node:assert/strict";
import { fetchGatewayObservation, gatewayAmount, gatewayCapabilities, gatewayUnits, normalizeGatewayBalances, normalizeGatewayInfo } from "../packages/arc-data/gateway.js";
import { gatewayHtml } from "../packages/agent-modules/gateway-view.js";
import { createGatewayReceipt } from "../packages/evidence/gateway-receipt.js";
import { verifyReceiptDocument } from "../packages/evidence/index.js";
import handler from "../server/app-kits/gateway.js";

const depositor = `0x${"1".repeat(40)}`;
const contract = `0x${"2".repeat(40)}`;
const entry = (domain, chain, supportedTokens) => ({ domain, chain, network: "Mainnet", walletContract: { address: contract, supportedTokens }, minterContract: { address: contract, supportedTokens }, processedHeight: "123" });
const info = () => ({ domains: [entry(26, "Arc", ["USDC", "EURC", "cirBTC"]), entry(0, "Ethereum", ["USDC", "EURC", "cirBTC"]), entry(6, "Base", ["USDC", "EURC"])] });
const responseMock = () => ({ setHeader(key, value) { (this.headers ??= {})[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test("asset decimals preserve exact units without floating-point or implicit conversion", () => {
  assert.equal(gatewayUnits("0.00000001", 8), "1");
  assert.equal(gatewayUnits("0.00000001", 6), null);
  assert.equal(gatewayUnits("12345678901234567890.123456", 6), "12345678901234567890123456");
  assert.equal(gatewayAmount("1", 8), "0.00000001");
  for (const bad of [null, 0, "", "-1", "1e6", "1.", "NaN", "01.00"]) assert.equal(gatewayUnits(bad, 6), null);
});

test("capability requires asset support at source wallet and Arc destination minter", () => {
  const domains = normalizeGatewayInfo(info());
  const btc = gatewayCapabilities(domains).find(item => item.token === "cirBTC");
  assert.equal(btc.routes.find(item => item.domain === 0).status, "SUPPORTED_BY_API");
  assert.equal(btc.routes.find(item => item.domain === 6).status, "NOT_SUPPORTED");
  domains[0].minter.tokens = [];
  assert.equal(gatewayCapabilities(domains)[0].routes[1].status, "NOT_SUPPORTED");
  domains[0].minter.tokens = null;
  assert.equal(gatewayCapabilities(domains)[0].routes[1].status, "UNKNOWN");
});

test("mainnet domain data rejects duplicates and testnet, and does not infer unknown ecosystems", () => {
  const duplicate = info(); duplicate.domains.push(duplicate.domains[0]);
  assert.throws(() => normalizeGatewayInfo(duplicate), /identity/);
  const testnet = info(); testnet.domains[0].network = "Testnet";
  assert.throws(() => normalizeGatewayInfo(testnet), /identity/);
  const data = info(); data.domains.push(entry(99, "UnknownFutureChain", ["USDC"]));
  assert.equal(normalizeGatewayInfo(data).at(-1).evm, false);
});

test("balance validation distinguishes a reported zero from a missing value", () => {
  const sources = [{ domain: 26, chain: "Arc" }, { domain: 0, chain: "Ethereum" }];
  const options = { token: "USDC", decimals: 6, depositor, sources };
  const observation = normalizeGatewayBalances({ token: "USDC", balances: [{ domain: 26, depositor, balance: "0" }] }, options);
  assert.equal(observation.balances[0].confirmedUnits, "0");
  assert.equal(observation.balances[1].confirmedUnits, null);
  assert.equal(observation.confirmedUnits, null);
  assert.equal(observation.status, "PARTIAL_EVIDENCE");
});

test("balances reject duplicate, mismatched token, depositor and unexpected domain identities", () => {
  const options = { token: "cirBTC", decimals: 8, depositor, sources: [{ domain: 26, chain: "Arc" }] };
  const item = { domain: 26, depositor, balance: "1" };
  for (const payload of [
    { token: "CIRBTC", balances: [item] },
    { token: "cirBTC", balances: [item, item] },
    { token: "cirBTC", balances: [{ ...item, depositor: contract }] },
    { token: "cirBTC", balances: [{ ...item, domain: 1 }] }
  ]) assert.throws(() => normalizeGatewayBalances(payload, options));
});

test("query sends each token explicitly and keeps asset totals separate", async () => {
  const calls = [];
  const observation = await fetchGatewayObservation({ depositor }, { fetcher: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/info")) return { ok: true, json: async () => info() };
    const body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ token: body.token, balances: body.sources.map(source => ({ ...source, balance: body.token === "cirBTC" ? "0.00000001" : "1.000000" })) }) };
  } });
  assert.deepEqual(observation.assets.map(asset => [asset.token, asset.confirmedUnits]), [["USDC", "3000000"], ["EURC", "3000000"], ["cirBTC", "2"]]);
  assert.equal(Object.hasOwn(observation, "totalUsd"), false);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(call => call.url.startsWith("https://gateway-api.circle.com/v1/") && call.options.redirect === "error"));
  assert.deepEqual(calls.slice(1).map(call => JSON.parse(call.options.body).token), ["USDC", "EURC", "cirBTC"]);
  assert.ok(calls.slice(1).every(call => call.url.endsWith("/balances")));
});

test("coverage lookup never requests balances or a signature", async () => {
  const calls = [];
  const observation = await fetchGatewayObservation({}, { fetcher: async (url, options) => { calls.push(options.method); return { ok: true, json: async () => info() }; } });
  assert.deepEqual(calls, ["GET"]);
  assert.ok(observation.assets.every(asset => asset.status === "NOT_REQUESTED" && asset.confirmedUnits === null));
});

test("an unavailable asset does not erase successful observations or invent a zero", async () => {
  const observation = await fetchGatewayObservation({ depositor }, { fetcher: async (url, options) => {
    if (url.endsWith("/info")) return { ok: true, json: async () => info() };
    const body = JSON.parse(options.body);
    return body.token === "EURC" ? { ok: false, status: 429 } : { ok: true, json: async () => ({ token: body.token, balances: body.sources.map(source => ({ ...source, balance: "0" })) }) };
  } });
  assert.equal(observation.assets[0].confirmedUnits, "0");
  assert.equal(observation.assets[1].confirmedUnits, null);
  assert.equal(observation.assets[1].status, "UNAVAILABLE");
});

test("unknown token coverage withholds a total even if known domains returned balances", async () => {
  const data = info(); delete data.domains[2].walletContract.supportedTokens;
  const observation = await fetchGatewayObservation({ depositor }, { fetcher: async (url, options) => {
    if (url.endsWith("/info")) return { ok: true, json: async () => data };
    const body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ token: body.token, balances: body.sources.map(source => ({ ...source, balance: "0" })) }) };
  } });
  assert.ok(observation.assets.every(asset => asset.confirmedUnits === null && asset.status === "PARTIAL_EVIDENCE"));
});

test("endpoint rejects writes and invalid inputs and disables shared caching", async context => {
  let response = responseMock(); await handler({ method: "POST" }, response); assert.equal(response.code, 405);
  response = responseMock(); await handler({ method: "GET", url: "/api/app-kits/gateway?depositor=bad" }, response); assert.equal(response.code, 400);
  const previousFetch = globalThis.fetch; context.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => ({ ok: true, json: async () => info() });
  response = responseMock(); await handler({ method: "GET", url: "/api/app-kits/gateway" }, response);
  assert.equal(response.code, 200); assert.equal(response.headers["Cache-Control"], "no-store");
});

test("downloaded receipts detect tampering and the panel escapes upstream strings", async () => {
  const observation = await fetchGatewayObservation({}, { fetcher: async () => ({ ok: true, json: async () => info() }) });
  const receipt = createGatewayReceipt(observation);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
  receipt.observation.assets[0].confirmedUnits = "42";
  assert.equal(verifyReceiptDocument(receipt).valid, false);
  observation.assets[0].routes[1].chain = '<img src=x onerror="alert(1)">';
  assert.equal(gatewayHtml({ mode: "ready", observation }, depositor).includes('<img'), false);
});
