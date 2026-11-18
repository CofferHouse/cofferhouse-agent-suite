import test from "node:test";
import assert from "node:assert/strict";
import { fetchMeteoraHistory, normalizeMeteoraHistory, isSolanaSignature } from "../packages/arc-data/meteora-history.js";
import { evaluateLiquidityCashflows } from "../packages/agent-modules/liquidity-cashflows.js";
import { currentHistoryReceipt, meteoraHistoryHtml } from "../packages/agent-modules/meteora-history-view.js";
import { createMeteoraHistoryHandler } from "../server/scout/meteora-history.js";
import cashflowsHandler from "../server/strategy/liquidity-cashflows.js";
import router from "../api/index.js";
import { verifyReceiptDocument } from "../packages/evidence/index.js";
const target={pool:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",user:"11111111111111111111111111111111",position:"So11111111111111111111111111111111111111112"};
const mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", signature="1".repeat(64);
const time="2026-11-18T12:00:00.000Z";
const event=(changes={})=>({signature,ixIndex:0,eventType:"add",positionAddress:target.position,poolAddress:target.pool,userAddress:target.user,tokenX:target.position,tokenY:mint,blockTime:1795000000,slot:100,createdAt:time,amountX:"1",amountY:"1",amountXUsd:"50",amountYUsd:"50",totalUsd:"100",...changes});
const history=events=>normalizeMeteoraHistory({events},target,time);
const receipt=events=>currentHistoryReceipt(history(events));
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test("indexed history preserves raw units, identity and exact event deduplication",()=>{
 const row=event({amountX:"123456789012345678901234567890.000000000000000001"});
 const result=history([row,{...row},event({ixIndex:1,eventType:"claim_fee",userAddress:mint})]);
 assert.equal(result.events.length,2);assert.equal(result.duplicatesCollapsed,1);assert.equal(result.coverage,"UNVERIFIED");
 assert.equal(result.onchainVerified,false);assert.equal(result.tokenAmountUnitsVerified,false);
 assert.equal(result.events[0].amountX,row.amountX);assert.ok(result.warnings.includes("DIFFERENT_EVENT_ACTOR"));
 assert.throws(()=>history([row,{...row,totalUsd:"101"}]),/CONFLICTING_HISTORY_EVENT/);
 assert.equal(verifyReceiptDocument(currentHistoryReceipt(result)).valid,true);
});
test("history rejects wrong position, pool, malformed signature and oversized event lists",()=>{
 assert.equal(isSolanaSignature(signature),true);assert.equal(isSolanaSignature(target.position),false);
 for(const change of [{poolAddress:mint},{positionAddress:mint},{userAddress:"private"},{signature:"bad"},{ixIndex:-1},{slot:1.5},{blockTime:Infinity},{createdAt:"invalid"}]) assert.throws(()=>history([event(change)]),/INVALID_HISTORY/);
 assert.throws(()=>history(Array.from({length:201},(_,ixIndex)=>event({ixIndex}))),/HISTORY_LIMIT_EXCEEDED/);
});
test("USD valuation mismatches and unknown event kinds do not become known cashflows",()=>{
 const unknown=evaluateLiquidityCashflows(receipt([event({eventType:"new_action"})]));
 assert.equal(unknown.indexedCashflowBalanceUsd,null);
 for(const row of [event({totalUsd:"99"}),event({amountXUsd:null}),event({amountXUsd:50})]) {
  const result=evaluateLiquidityCashflows(receipt([row]));
  assert.equal(result.groups.add.usd,null);assert.equal(result.indexedCashflowBalanceUsd,null);
 }
 assert.equal(history([]).status,"NOT_OBSERVED");
});
test("history adapter has a fixed read-only source, explicit cap and no invented pagination",async()=>{
 const result=await fetchMeteoraHistory(target,{fetcher:async(url,options)=>{
  assert.equal(url,`https://dlmm.datapi.meteora.ag/positions/${target.position}/historical?order_direction=asc`);
  assert.equal(options.method,"GET");assert.equal(options.redirect,"error");
  return {ok:true,json:async()=>({events:[event()]})};
 }});assert.equal(result.status,"FOUND");
 for(const fetcher of [async()=>({ok:false}),async()=>{throw Error("private");},async()=>({ok:true,json:async()=>({events:[event({poolAddress:mint})]})})]) {
  const failed=await fetchMeteoraHistory(target,{fetcher});assert.equal(failed.status,"UNAVAILABLE");assert.equal(failed.events.length,0);assert.equal(JSON.stringify(failed).includes("private"),false);
 }
 const capped=await fetchMeteoraHistory(target,{fetcher:async()=>({ok:true,json:async()=>({events:Array(201).fill(event())})})});assert.equal(capped.status,"LIMIT_EXCEEDED");assert.deepEqual(capped.events,[]);
});
test("unpaginated history responses are bounded before JSON parsing",async()=>{
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(262145));c.close();}});
 const result=await fetchMeteoraHistory(target,{fetcher:async()=>({ok:true,body})});assert.equal(result.status,"LIMIT_EXCEEDED");
 const encoded=new TextEncoder().encode(JSON.stringify({events:[event()]}));
 const good=await fetchMeteoraHistory(target,{fetcher:async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(encoded.slice(0,30));c.enqueue(encoded.slice(30));c.close();}})})});assert.equal(good.status,"FOUND");
});
test("one transaction with multiple event types receives a cost exactly once",()=>{
 const doc=receipt([event(),event({ixIndex:1,eventType:"remove",amountXUsd:"45",amountYUsd:"45",totalUsd:"90"}),event({ixIndex:2,eventType:"claim_fee",amountXUsd:"5",amountYUsd:"10",totalUsd:"15"})]);
 const result=evaluateLiquidityCashflows(doc,[{signature,usd:"0.5"}]);
 assert.equal(result.eventCount,3);assert.equal(result.transactionCount,1);assert.equal(result.indexedCashflowBalanceUsd,"5");
 assert.equal(result.indexedBalanceAfterEnteredCostsUsd,"4.5");assert.equal(result.providedCostsUsd,"0.5");
 assert.equal(result.costCoverage,"ALL_OBSERVED_TRANSACTIONS_ENTERED");assert.equal(result.costsVerified,false);
 for(const metric of ["realizedProfitUsd","netReturnPct","costAdjustedPnlUsd","holdingBenchmarkUsd"])assert.equal(result[metric],null);
 assert.equal(result.execution.enabled,false);
});
test("missing costs are not zero and explicit zero only covers observed transactions",()=>{
 const doc=receipt([event()]);
 const missing=evaluateLiquidityCashflows(doc);assert.equal(missing.indexedBalanceAfterEnteredCostsUsd,null);assert.equal(missing.costCoverage,"MISSING_TRANSACTION_COSTS");
 const zero=evaluateLiquidityCashflows(doc,[{signature,usd:"0"}]);assert.equal(zero.indexedBalanceAfterEnteredCostsUsd,"-100");assert.equal(zero.realizedProfitUsd,null);
});
test("cashflow arithmetic preserves tiny USD values and sums beyond safe integer precision",()=>{
 const tiny=receipt([event({amountXUsd:"0.000000000000000001",amountYUsd:"0",totalUsd:"0.000000000000000001"})]);
 assert.equal(evaluateLiquidityCashflows(tiny,[{signature,usd:"0.000000000000000001"}]).indexedBalanceAfterEnteredCostsUsd,"-0.000000000000000002");
 const maximum="99999999999999999999999999999999";
 const large=receipt([event({amountXUsd:maximum,amountYUsd:"0",totalUsd:maximum}),event({ixIndex:1,amountXUsd:maximum,amountYUsd:"0",totalUsd:maximum})]);
 assert.equal(evaluateLiquidityCashflows(large).indexedCashflowBalanceUsd,"-199999999999999999999999999999998");
});
test("cost ledger rejects duplicates, unknown signatures, coercion, negative values and tampered receipts",()=>{
 const doc=receipt([event()]);
 for(const costs of [null,{},[{signature,usd:"1"},{signature,usd:"1"}],[{signature:"2".repeat(88),usd:"1"}],[{signature,usd:0}],[{signature,usd:"-1"}],[{signature,usd:"1e3"}],[{signature,usd:"1",apiKey:"no"}]])assert.throws(()=>evaluateLiquidityCashflows(doc,costs),/INVALID_COSTS/);
 const altered=structuredClone(doc);altered.history.events[0].totalUsd="1000";assert.throws(()=>evaluateLiquidityCashflows(altered),/INVALID_HISTORY_RECEIPT/);
 assert.throws(()=>evaluateLiquidityCashflows(receipt([])),/INVALID_HISTORY_RECEIPT/);
});
test("history API validates before fetching and stateless cost API supports rewritten routing",async()=>{
 let calls=0;const api=createMeteoraHistoryHandler({read:async input=>{calls++;assert.deepEqual(input,target);return history([event()]);}});
 assert.equal((await api({method:"GET"},response())).code,405);
 assert.equal((await api({method:"POST",body:{...target,position:"http://evil"}},response())).code,400);assert.equal(calls,0);
 assert.equal((await api({method:"POST",body:{...target,apiKey:"not-forwarded"}},response())).code,200);assert.equal(calls,1);
 const body={historyReceipt:receipt([event()]),costs:[{signature,usd:"0.5"}]};
 for(const url of ["/api/strategy/liquidity-cashflows","/api?endpoint=strategy/liquidity-cashflows"]){const r=await router({method:"POST",url,body},response());assert.equal(r.code,200);assert.equal(r.headers["Cache-Control"],"no-store");}
 assert.equal((await cashflowsHandler({method:"GET"},response())).code,405);
 assert.equal((await cashflowsHandler({method:"POST",body:{...body,execute:true}},response())).code,400);
});
test("history view hides data for an old position observation and escapes external cost values",()=>{
 const observed={pool:target.pool,position:target.position,queriedUser:target.user,observedAt:time};
 const state={mode:"ready",history:history([event()]),forObservationAt:time,costs:[{signature,usd:'\"><script>'}]};
 const html=meteoraHistoryHtml(state,observed);assert.equal(html.includes('<script>'),false);assert.match(html,/DOWNLOAD HISTORY RECEIPT/);
 assert.equal(meteoraHistoryHtml(state,{...observed,observedAt:"2026-11-19T12:00:00.000Z"}).includes('class="meteora-history-download"'),false);
 assert.equal(meteoraHistoryHtml({mode:"error"},observed).includes('class="meteora-cashflow-download"'),false);
});
