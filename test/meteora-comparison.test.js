import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMeteoraPosition } from "../packages/arc-data/meteora-position.js";
import { compareMeteoraPositionReceipts as compare, readMeteoraPositionReceipt } from "../packages/agent-modules/meteora-position-comparison.js";
import { meteoraComparisonHtml, currentPositionReceipt, positionComparison } from "../packages/agent-modules/meteora-comparison-view.js";
import { sealDocument, verifyReceiptDocument } from "../packages/evidence/index.js";
import handler from "../server/scout/meteora-comparison.js";
import router from "../api/index.js";

const target={pool:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",user:"11111111111111111111111111111111",position:"So11111111111111111111111111111111111111112"};
const other="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function observation(time="2026-11-17T12:00:00.000Z") {
 return normalizeMeteoraPosition({positionAddress:target.position,isClosed:false,lowerBinId:0,upperBinId:10,poolActiveBinId:5,isOutOfRange:false,pnlUsd:"-3.00",allTimeFees:{total:{usd:"12.25"}},allTimeDeposits:{total:{usd:"1000"}},allTimeWithdrawals:{total:{usd:"0"}}},{tokenX:target.position,tokenY:other},target,time);
}
function receipts(before={},after={}) {
 return [currentPositionReceipt({...observation(),...before}),currentPositionReceipt({...observation("2026-11-18T12:00:00.000Z"),providerPnlUsd:"2.00",providerAllTimeFeesUsd:"15.50",...after})];
}
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test("comparison keeps independent PnL, fees and cashflow deltas, never claiming realized returns",()=>{
 const [before,after]=receipts({}, {providerDepositsUsd:"1100",providerWithdrawalsUsd:"30"});
 const result=compare(before,after);
 assert.deepEqual(result.providerChangesUsd,{providerPnlUsd:"5",providerAllTimeFeesUsd:"3.25",providerDepositsUsd:"100",providerWithdrawalsUsd:"30"});
 assert.equal(result.capitalFlowState,"CHANGED");assert.equal(result.netDepositsMinusWithdrawalsUsd,"70");
 assert.equal(result.elapsedSeconds,86400);assert.equal(result.beforeReceiptId,before.receiptId);
 for(const name of ["costAdjustedPnlUsd","holdingBenchmarkUsd","netReturnPct","realizedProfitUsd"])assert.equal(result[name],null);
 assert.equal(result.sourceAuthenticated,false);assert.equal(result.execution.enabled,false);
 assert.ok(result.warnings.includes("CAPITAL_FLOWS_CHANGED"));
 const exported=sealDocument({schema:"cofferhouse.meteora.comparison-receipt.v1",comparison:result},"meteora-comparison");
 assert.equal(verifyReceiptDocument(exported).valid,true);
});
test("exact decimal deltas preserve tiny and very large USD changes without float rounding",()=>{
 const result=compare(...receipts({providerPnlUsd:"99999999999999999999999999999999.999999999999999998",providerAllTimeFeesUsd:"0.000000000000000001"},{providerPnlUsd:"99999999999999999999999999999999.999999999999999999",providerAllTimeFeesUsd:"0.000000000000000003"}));
 assert.equal(result.providerChangesUsd.providerPnlUsd,"0.000000000000000001");
 assert.equal(result.providerChangesUsd.providerAllTimeFeesUsd,"0.000000000000000002");
 const negative=compare(...receipts({providerPnlUsd:"0.000000000000000001"},{providerPnlUsd:"-0.000000000000000001"}));
 assert.equal(negative.providerChangesUsd.providerPnlUsd,"-0.000000000000000002");
});
test("unknown metrics remain unknown and decreased counters cannot imply earned fees or net flow",()=>{
 const unknown=compare(...receipts({providerDepositsUsd:null},{providerAllTimeFeesUsd:null}));
 assert.equal(unknown.capitalFlowState,"UNKNOWN");assert.equal(unknown.netDepositsMinusWithdrawalsUsd,null);
 assert.equal(unknown.providerChangesUsd.providerAllTimeFeesUsd,null);
 assert.ok(unknown.warnings.includes("METRICS_UNKNOWN"));
 const decreased=compare(...receipts({}, {providerDepositsUsd:"900",providerAllTimeFeesUsd:"10"}));
 assert.equal(decreased.capitalFlowState,"COUNTER_DECREASED");assert.equal(decreased.netDepositsMinusWithdrawalsUsd,null);
 assert.equal(decreased.providerChangesUsd.providerAllTimeFeesUsd,"-2.25");assert.ok(decreased.warnings.includes("PROVIDER_COUNTER_DECREASED"));
 const unchanged=compare(...receipts());assert.equal(unchanged.capitalFlowState,"NO_CHANGE_OBSERVED");
});
test("position identity, queried wallet, token ordering and chronological observations must match",()=>{
 for(const change of [{pool:other},{position:other},{queriedUser:other},{tokenX:{mint:other},tokenY:{mint:target.position}},{tokenX:{mint:null}}]) assert.throws(()=>compare(...receipts({},change)),/POSITION_MISMATCH|IDENTITY_UNCONFIRMED/);
 for(const observedAt of ["2026-11-17T12:00:00.000Z","2026-11-16T12:00:00.000Z"])assert.throws(()=>compare(...receipts({}, {observedAt})),/OBSERVATIONS_NOT_ORDERED/);
 const [before,after]=receipts();assert.throws(()=>compare(after,before),/OBSERVATIONS_NOT_ORDERED/);
});
test("tampering, missing data, oversized receipts and inconsistent range assertions are rejected",()=>{
 const [before,after]=receipts();
 // Export time uses the client clock; it must not override observation chronology.
 assert.equal(readMeteoraPositionReceipt(sealDocument({schema:before.schema,generatedAt:"2026-11-16T12:00:00.000Z",observation:before.observation},"meteora-position")).id,before.observation.id);
 const altered=structuredClone(before);altered.observation.providerPnlUsd="100";
 assert.throws(()=>compare(altered,after),/INVALID_RECEIPT/);
 for(const change of [{providerPnlUsd:5},{providerAllTimeFeesUsd:"-1"},{providerDepositsUsd:undefined},{observedAt:"yesterday"},{source:"untrusted"},{onchainVerified:true},{range:{...observation().range,state:"OUT_OF_RANGE"}}])assert.throws(()=>compare(...receipts({},change)),/INVALID_OBSERVATION|INVALID_RECEIPT/);
 assert.throws(()=>readMeteoraPositionReceipt({...before,padding:"x".repeat(32768)}),/INVALID_RECEIPT/);
 assert.throws(()=>readMeteoraPositionReceipt(sealDocument({schema:before.schema,observation:before.observation},"meteora-position")),/INVALID_RECEIPT/);
});
test("range boundary, out-of-range and unknown statuses are visible without claiming profitability",()=>{
 const result=compare(...receipts({}, {range:{lowerBinId:1,activeBinId:12,upperBinId:11,isClosed:false,providerOutOfRange:true,state:"OUT_OF_RANGE"}}));
 assert.equal(result.range.boundsChanged,true);assert.ok(result.warnings.includes("POSITION_RANGE_CHANGED"));assert.ok(result.warnings.includes("POSITION_OUT_OF_RANGE"));
 const unknown=compare(...receipts({}, {range:{...observation().range,lowerBinId:null,state:"UNKNOWN"}}));
 assert.equal(unknown.range.boundsChanged,null);assert.ok(unknown.warnings.includes("RANGE_UNCONFIRMED"));
});
test("view hides comparisons without a current observation and rejects stale or mismatched baselines",()=>{
 const [before,after]=receipts();
 assert.equal(positionComparison({receipt:before},after.observation).result.providerChangesUsd.providerPnlUsd,"5");
 assert.equal(positionComparison({receipt:after},before.observation).error,true);
 assert.equal(positionComparison({receipt:before},null).result,null);
 assert.equal(meteoraComparisonHtml({receipt:before},null).includes('class="meteora-comparison-download"'),false);
 assert.equal(meteoraComparisonHtml({receipt:null,error:true},after.observation).includes('class="meteora-comparison-download"'),false);
});
test("comparison HTTP route is stateless, rejects malformed input and supports Vercel rewrites",async()=>{
 const [before,after]=receipts();
 for(const input of [{url:"/api/scout/meteora-comparison",method:"POST",body:{before,after}},{url:"/api?endpoint=scout/meteora-comparison",method:"POST",body:{before,after}}]) {
  const result=await router(input,res());assert.equal(result.code,200);assert.equal(result.headers["Cache-Control"],"no-store");
  assert.equal(result.body.comparison.netReturnPct,null);
 }
 for(const body of [null,[],{before},{before,after,execute:true},{before:after,after:before}]) {
  const result=await handler({method:"POST",body},res());assert.equal(result.code,400);assert.equal(result.body.comparison,undefined);
 }
 assert.equal((await handler({method:"GET"},res())).code,405);
});
