import test from "node:test";
import assert from "node:assert/strict";
import { compareVaultExposure, fetchVaultExposure, formatVaultUnits, normalizeVaultExposure } from "../packages/arc-data/vault-exposure.js";
import { createVaultExposureReceipt } from "../packages/evidence/vault-exposure-receipt.js";
import { verifyReceiptDocument } from "../packages/evidence/index.js";
import { vaultExposureHtml } from "../packages/agent-modules/vault-exposure-view.js";
import handler from "../server/app-kits/vault-exposure.js";

const vaultAddress = `0x${"1".repeat(40)}`;
const asset = `0x${"2".repeat(40)}`;
const market = `0x${"3".repeat(64)}`;
const adapter = `0x${"4".repeat(40)}`;
function fixture(version = 1) {
  const identity = { chain_id: 5042, last_indexed_block: "123" };
  return {
    config: { ...identity, address: vaultAddress, version: `${version}.0`, asset: { address: asset, symbol: "USDC", decimals: 6 }, owner: vaultAddress, curator: asset },
    state: { ...identity, address: vaultAddress, total_assets: "100000000", withdrawable_assets: "20000000", idle_assets: version === 2 ? "40000000" : undefined },
    allocations: { ...identity, vault_address: vaultAddress, allocations: version === 1
      ? [{ market_id: market, supply_assets: "100000000", supply_cap: "200000000" }]
      : [{ adapter_address: adapter, caps: [
        { cap_type: "adapter", allocated_assets: "60000000", absolute_cap: "100000000", relative_cap_wad: "500000000000000000" },
        { cap_type: "market_v1", market_id: market, allocated_assets: "60000000", absolute_cap: "100000000" }
      ] }] }
  };
}
const normalize = (data, version = 1) => normalizeVaultExposure(data, { vaultAddress, version, observedAt: "2026-10-28T20:00:00.000Z" });

test("V1 records roles, native asset units and market concentration without inventing idle assets", () => {
  const observation = normalize(fixture());
  assert.equal(observation.roles.curator, asset);
  assert.equal(observation.roles.allocators, null);
  assert.equal(observation.idleAssetsUnits, null);
  assert.equal(observation.withdrawalCoveragePct, 20);
  assert.equal(observation.largestPositionPct, 100);
  assert.equal(observation.reconciled, true);
});

test("V2 counts adapter allocations once and detects relative cap drift", () => {
  const observation = normalize(fixture(2), 2);
  assert.equal(observation.allocatedAssetsUnits, "60000000");
  assert.equal(observation.largestPositionPct, 60);
  assert.equal(observation.positions[0].riskCaps[0].exceedsRelativeCap, true);
  assert.equal(observation.reconciled, true);
  assert.match(observation.warnings.join(" "), /cap/);
});

test("mixed source blocks withhold combined allocations, ratios and comparison", () => {
  const data = fixture(); data.allocations.last_indexed_block = "122";
  const observation = normalize(data);
  assert.equal(observation.aligned, false);
  assert.equal(observation.allocatedAssetsUnits, null);
  assert.equal(observation.positions[0].sharePct, null);
  assert.equal(observation.largestPositionPct, null);
  assert.equal(compareVaultExposure(normalize(fixture()), observation).status, "NOT_COMPARABLE");
});

test("unknown or malformed amounts do not become zero or a complete exposure", () => {
  for (const value of [null, undefined, "", "NaN", "-1", 0, "1e8"]) {
    const data = fixture(); data.allocations.allocations[0].supply_assets = value;
    const observation = normalize(data);
    assert.equal(observation.positions[0].allocatedUnits, null);
    assert.equal(observation.reconciled, false);
    assert.equal(observation.largestPositionPct, null);
  }
});

test("empty arrays do not imply that positive assets are fully explained", () => {
  const data = fixture(); data.allocations.allocations = [];
  assert.equal(normalize(data).reconciled, false);
});

test("missing liquidity and asset metadata remain partial even when allocation totals match", () => {
  const data = fixture(); data.state.withdrawable_assets = null; data.config.asset.decimals = null;
  const observation = normalize(data);
  assert.equal(observation.status, "PARTIAL_EVIDENCE");
  assert.equal(observation.withdrawalCoveragePct, null);
  assert.equal(compareVaultExposure(normalize(fixture()), observation).status, "NOT_COMPARABLE");
});

test("unscoped V2 caps are reviewed without being added to allocation totals", () => {
  const data = fixture(2);
  data.allocations.unscoped_caps = [{ cap_type: "collateral", allocated_assets: "60000000", absolute_cap: "50000000" }];
  const observation = normalize(data, 2);
  assert.equal(observation.unscopedCaps[0].exceedsAbsoluteCap, true);
  assert.equal(observation.allocatedAssetsUnits, "60000000");
});

test("rejects wrong chains, addresses, versions and duplicate positions", () => {
  for (const key of ["config", "state", "allocations"]) {
    const data = fixture(); data[key].chain_id = 1;
    assert.throws(() => normalize(data), /identity/);
  }
  const wrong = fixture(); wrong.state.address = asset;
  assert.throws(() => normalize(wrong), /identity/);
  const version = fixture(); version.config.version = "2.0";
  assert.throws(() => normalize(version), /version/);
  const duplicates = fixture(); duplicates.allocations.allocations.push({ ...duplicates.allocations.allocations[0] });
  assert.throws(() => normalize(duplicates), /duplicated/);
});

test("V2 missing or ambiguous adapter balance is unknown, not a sum of overlapping caps", () => {
  const data = fixture(2); data.allocations.allocations[0].caps[0].cap_type = "collateral";
  assert.equal(normalize(data, 2).positions[0].allocatedUnits, null);
});

test("integer formatting preserves large balances and missing decimals", () => {
  assert.equal(formatVaultUnits("123456789012345678901234567890", 6), "123456789012345678901234.567890");
  assert.equal(formatVaultUnits("1", 6), "0.000001");
  assert.equal(formatVaultUnits(null, 6), null);
  assert.equal(formatVaultUnits("1", null), null);
});

test("comparison reports role and liquidity changes only for later comparable blocks", () => {
  const previous = normalize(fixture());
  const data = fixture();
  for (const value of Object.values(data)) value.last_indexed_block = "124";
  data.config.curator = adapter; data.state.withdrawable_assets = "10000000";
  const current = normalize(data);
  assert.deepEqual(compareVaultExposure(previous, current).changes.map(change => change.kind), ["ROLE_CHANGED", "LIQUIDITY_DECREASED"]);
  assert.equal(compareVaultExposure(current, previous).status, "NOT_COMPARABLE");
  assert.equal(compareVaultExposure(previous, previous).status, "NOT_COMPARABLE");
});

test("receipt detects changed allocation evidence and HTML escapes provider strings", () => {
  const observation = normalize(fixture());
  const receipt = createVaultExposureReceipt(observation);
  assert.equal(verifyReceiptDocument(receipt).valid, true);
  receipt.observation.totalAssetsUnits = "0";
  assert.equal(verifyReceiptDocument(receipt).valid, false);
  observation.asset.symbol = '<img src=x onerror="alert(1)">';
  assert.equal(vaultExposureHtml({ mode: "ready", observation }).includes('<img'), false);
});

test("adapter uses fixed Arc routes and V2 state endpoint without guessing another chain", async () => {
  const data = fixture(2), calls = [];
  const observation = await fetchVaultExposure(vaultAddress, { fetcher: async (url, options) => {
    calls.push({ url, options });
    if (url.includes("vaults-v1/")) return { status: 404, ok: false };
    return { ok: true, json: async () => ({ data: url.endsWith("/state") ? data.state : url.endsWith("/allocations") ? data.allocations : data.config }) };
  } });
  assert.equal(observation.version, 2);
  assert.ok(calls.every(call => call.url.startsWith("https://api.morpho.org/") && call.url.includes("5042:")));
  assert.ok(calls.some(call => call.url.includes("/v1/vaults-v2/") && call.url.endsWith("/state")));
  assert.ok(calls.every(call => call.options.redirect === "error"));
});

test("adapter refuses unavailable, ambiguous and failed sources", async () => {
  await assert.rejects(fetchVaultExposure(vaultAddress, { fetcher: async () => ({ ok: false, status: 404 }) }), /unavailable/);
  await assert.rejects(fetchVaultExposure(vaultAddress, { fetcher: async () => ({ ok: false, status: 429 }) }), /unavailable/);
  await assert.rejects(fetchVaultExposure(vaultAddress, { fetcher: async () => ({ ok: true, json: async () => ({ data: fixture().config }) }) }), /ambiguous/);
  await assert.rejects(fetchVaultExposure("https://evil.test"), /address/);
});

test("public endpoint rejects writes and invalid addresses before fetching", async () => {
  const response = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method: "POST" }, response); assert.equal(response.code, 405);
  await handler({ method: "GET", url: "/api/app-kits/vault-exposure?vault=bad" }, response); assert.equal(response.code, 400);
});
