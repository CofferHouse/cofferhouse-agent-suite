import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMeteoraPools, fetchMeteoraPools } from "../packages/arc-data/meteora.js";
import { screenLiquidityPools } from "../packages/agent-modules/liquidity-research.js";
import { createMeteoraHandler } from "../server/scout/meteora.js";
import { meteoraHtml } from "../packages/agent-modules/meteora-view.js";
import { evaluateLiquidityScenario } from "../packages/agent-modules/liquidity-scenario.js";

const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const sol = "So11111111111111111111111111111111111111112";
const pool = "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6";
const row = () => ({ address: pool, token_x: {address: sol, symbol: "SOL", is_verified: true, freeze_authority_disabled: true}, token_y: {address: mint, symbol: "USDC", is_verified: true, freeze_authority_disabled: true}, tvl: 100000, volume: {"24h": 20000}, fees: {"24h": 100}, is_blacklisted: false });
const page = rows => ({current_page: 1, data: rows});

test("DLMM pool observations preserve Solana identity and do not invent position earnings", () => {
  const [normalized] = normalizeMeteoraPools(page([row()]));
  assert.equal(normalized.id, `solana:mainnet:meteora-dlmm:${pool}`);
  assert.equal(normalized.tokenY.mint, mint);
  assert.equal(normalized.poolFees24hUsd, 100);
  assert.equal(normalized.positionPnlUsd, null);
  assert.equal(normalized.netReturnPct, null);
  assert.equal(normalized.tokenSecurityVerified, false);
  assert.throws(() => normalizeMeteoraPools(page([row(), row()])), /identity/);
  assert.throws(() => normalizeMeteoraPools(page([{...row(), address: "0x" + "a".repeat(40)}])), /identity/);
  assert.throws(() => normalizeMeteoraPools({current_page: 2, data: []}), /page/);
});

test("LP screening excludes missing metrics, blacklisted pools and unresolved freeze permissions", () => {
  for (const override of [{tvl: null}, {volume: {"24h": null}}, {is_blacklisted: true}, {is_blacklisted: undefined}, {token_x: {...row().token_x, freeze_authority_disabled: false}}]) {
    const pools = normalizeMeteoraPools(page([{...row(), ...override}]));
    const result = screenLiquidityPools({status: "FOUND", pools});
    assert.equal(result.matches, 0);
    assert.equal(result.candidates[0].decision, "FILTERED_OUT");
    assert.equal(result.execution.enabled, false);
  }
  const result = screenLiquidityPools({status: "FOUND", pools: normalizeMeteoraPools(page([row()]))});
  assert.equal(result.matches, 1);
  assert.equal(result.candidates[0].decision, "REVIEW_REQUIRED");
  assert.equal(screenLiquidityPools({pools: result.pools}, {minTvlUsd: 200000}).matches, 0);
  assert.throws(() => screenLiquidityPools({pools: []}, {minTvlUsd: null}), /filters/);
});

test("Meteora adapter uses the fixed public API and reports outages distinctly from an empty page", async () => {
  const found = await fetchMeteoraPools({fetcher: async (url, options) => {
    assert.equal(url, "https://dlmm.datapi.meteora.ag/pools?page=1&page_size=20&sort_by=tvl%3Adesc");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, undefined);
    return {ok: true, json: async () => page([row()])};
  }});
  assert.equal(found.status, "FOUND");
  const empty = await fetchMeteoraPools({fetcher: async () => ({ok: true, json: async () => page([])})});
  assert.equal(empty.status, "NO_MATCH");
  for (const fetcher of [async () => ({ok: false}), async () => ({ok: true, json: async () => []}), async () => {throw Error("provider detail") }]) {
    const unavailable = await fetchMeteoraPools({fetcher});
    assert.equal(unavailable.status, "UNAVAILABLE");
    assert.equal(unavailable.sampled, null);
    assert.equal(JSON.stringify(unavailable).includes("provider detail"), false);
  }
});

test("Meteora endpoint rejects writes and invalid filters before provider access; pool labels are escaped", async () => {
  let calls=0;
  const handler = createMeteoraHandler({read: async () => {calls++;return {status:"FOUND",pools:normalizeMeteoraPools(page([{...row(),token_x:{...row().token_x,symbol:"<img>"}}]))};}});
  const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  assert.equal((await handler({method:"POST"},res())).code,405);
  assert.equal((await handler({method:"GET",url:"/api/scout/meteora?minTvlUsd=-1"},res())).code,400);
  assert.equal(calls,0);
  const response = await handler({method:"GET",url:"/api/scout/meteora?minTvlUsd=100000&minVolume24hUsd=20000"},res());
  assert.equal(response.code,200);
  assert.equal(response.body.observation.matches,1);
  const html = meteoraHtml({mode:"ready",minTvlUsd:100000,minVolume24hUsd:20000,observation:response.body.observation});
  assert.equal(html.includes("<img>"),false);
  assert.ok(html.includes("&lt;img&gt;"));
  assert.equal(meteoraHtml({mode:"error",observation:null}).includes("meteora-download"),false);
});

const assumptions = () => ({capitalUsd:1000,principalUsd:960,positionFeesUsd:100,costsUsd:20,holdingValueUsd:1050,stressPrincipalUsd:850,feeHaircutPct:50,minProfitUsd:50,maxStressLossPct:5,horizonDays:7});
test("positive LP earnings can still fail the holding benchmark, profit target and adverse-loss limit", () => {
  const result=evaluateLiquidityScenario(assumptions());
  assert.equal(result.netPnlUsd,40);
  assert.equal(result.versusHoldingUsd,-10);
  assert.equal(result.stressPnlUsd,-120);
  assert.equal(result.requiredPositionFeesUsd,110);
  assert.deepEqual(result.blockers,["PROFIT_BELOW_TARGET","UNDERPERFORMS_HOLDING","STRESS_LOSS_ABOVE_LIMIT"]);
  assert.equal(result.decision,"OUTSIDE_PAPER_LIMITS");
});
test("sufficient position fees clear only the paper limits; losses are never hidden by fees or annualized", () => {
  const result=evaluateLiquidityScenario({...assumptions(),positionFeesUsd:200,stressPrincipalUsd:950});
  assert.equal(result.netPnlUsd,140);
  assert.equal(result.versusHoldingUsd,90);
  assert.equal(result.stressPnlUsd,30);
  assert.equal(result.decision,"WITHIN_PAPER_LIMITS");
  assert.equal(result.execution.enabled,false);
  const loss=evaluateLiquidityScenario({...assumptions(),principalUsd:500});
  assert.equal(loss.netPnlUsd,-420);
  for (const change of [{capitalUsd:0},{positionFeesUsd:NaN},{principalUsd:null},{feeHaircutPct:101},{horizonDays:0}]) assert.throws(()=>evaluateLiquidityScenario({...assumptions(),...change}),/assumptions/);
});
