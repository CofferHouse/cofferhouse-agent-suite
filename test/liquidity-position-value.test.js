import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMeteoraHistory } from "../packages/arc-data/meteora-history.js";
import { normalizeMeteoraPosition } from "../packages/arc-data/meteora-position.js";
import { currentHistoryReceipt } from "../packages/agent-modules/meteora-history-view.js";
import { currentPositionReceipt } from "../packages/agent-modules/meteora-comparison-view.js";
import { evaluateLiquidityCashflows } from "../packages/agent-modules/liquidity-cashflows.js";
import { liquidityPositionValueHtml } from "../packages/agent-modules/liquidity-position-value-view.js";
import { sealDocument, verifyReceiptDocument } from "../packages/evidence/index.js";
import handler from "../server/strategy/liquidity-cashflows.js";
const target={pool:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",user:"11111111111111111111111111111111",position:"So11111111111111111111111111111111111111112"};
const mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",signature="1".repeat(64),time="2026-11-19T12:00:00.000Z";
function history({observedAt=time,blockTime=Math.floor(Date.parse(time)/1000)-10,extra={}}={}) {
 return currentHistoryReceipt(normalizeMeteoraHistory({events:[{eventType:"add",ixIndex:0,amountXUsd:"50",amountYUsd:"50",totalUsd:"100"},{eventType:"remove",ixIndex:1,amountXUsd:"45",amountYUsd:"45",totalUsd:"90"},{eventType:"claim_fee",ixIndex:2,amountXUsd:"5",amountYUsd:"10",totalUsd:"15"}].map(e=>({...e,signature,positionAddress:target.position,poolAddress:target.pool,userAddress:target.user,tokenX:target.position,tokenY:mint,blockTime,slot:100,createdAt:time,amountX:"1",amountY:"1",...extra}))},target,observedAt));
}
function position(changes={},observedAt=time) {
 const observation=normalizeMeteoraPosition({positionAddress:target.position,isClosed:false,lowerBinId:0,upperBinId:10,poolActiveBinId:5,isOutOfRange:false,pnlUsd:"999",allTimeFees:{total:{usd:"888"}},unrealizedPnl:{balanceTokenX:{amount:"1",usd:"120"},balanceTokenY:{amount:"1",usd:"20"},unclaimedFeeTokenX:{amount:"1",usd:"10"},unclaimedFeeTokenY:{amount:"1",usd:"3"}}},{tokenX:target.position,tokenY:mint},target,observedAt);
 return currentPositionReceipt({...observation,...changes});
}
const costs=[{signature,usd:"0.5"}];
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test("position balance reference includes observed balances without adding pending or lifetime fees and provider PnL",()=>{
 const source=history(),snapshot=position(),result=evaluateLiquidityCashflows(source,costs,snapshot),value=result.positionValue;
 assert.equal(result.indexedCashflowBalanceUsd,"5");assert.equal(result.indexedBalanceAfterEnteredCostsUsd,"4.5");
 assert.equal(value.providerBalanceComponentsUsd.total,"140");assert.equal(value.providerPendingFeeComponentsUsd.total,"13");
 assert.equal(value.balanceOnlyReferenceUsd,"145");assert.equal(value.balanceOnlyReferenceAfterEnteredCostsUsd,"144.5");
 assert.equal(value.pendingFeesAdded,false);assert.equal(value.pendingRewardsAdded,false);assert.equal(value.valuationVerified,false);
 assert.equal(value.status,"REFERENCE_ONLY");assert.equal(value.realizedProfitUsd,null);assert.equal(result.realizedProfitUsd,null);
 assert.equal(value.positionReceiptId,snapshot.receiptId);assert.equal(value.historyReceiptId,source.receiptId);
 const exported=sealDocument({schema:"cofferhouse.liquidity.cashflow-receipt.v1",historyReceipt:source,positionReceipt:snapshot,cashflows:result},"lp-cashflows");
 assert.equal(verifyReceiptDocument(exported).valid,true);
});
test("missing balances never become zero, while missing pending fees cannot be silently included",()=>{
 const original=position().observation;
 const missing=position({tokenY:{...original.tokenY,principalUsd:null}});
 const value=evaluateLiquidityCashflows(history(),costs,missing).positionValue;
 assert.equal(value.balanceOnlyReferenceUsd,null);assert.equal(value.providerBalanceComponentsUsd.total,null);assert.ok(value.reasons.includes("POSITION_BALANCES_UNKNOWN"));
 const unknownFees=position({tokenY:{...original.tokenY,unclaimedFeeUsd:null}});
 const reference=evaluateLiquidityCashflows(history(),costs,unknownFees).positionValue;
 assert.equal(reference.balanceOnlyReferenceUsd,"145");assert.equal(reference.providerPendingFeeComponentsUsd.total,null);assert.ok(reference.warnings.includes("PENDING_FEES_UNKNOWN"));
});
test("missing external costs suppress the adjusted reference but retain the separate before-cost reference",()=>{
 const value=evaluateLiquidityCashflows(history(),[],position()).positionValue;
 assert.equal(value.balanceOnlyReferenceUsd,"145");assert.equal(value.balanceOnlyReferenceAfterEnteredCostsUsd,null);
 assert.ok(value.warnings.includes("ADJUSTED_CASHFLOWS_UNAVAILABLE"));
 assert.equal(evaluateLiquidityCashflows(history(),costs).positionValue,null);
});
test("position/history references require exact position, wallet and token identities and untampered receipts",()=>{
 const obs=position().observation;
 for(const change of [{queriedUser:mint},{tokenX:{...obs.tokenX,mint},tokenY:{...obs.tokenY,mint:target.position}}])assert.throws(()=>evaluateLiquidityCashflows(history(),costs,position(change)),/POSITION_HISTORY_MISMATCH|POSITION_TOKEN_MISMATCH/);
 const altered=position();altered.observation.tokenX.principalUsd="1000000";
 assert.throws(()=>evaluateLiquidityCashflows(history(),costs,altered),/INVALID_RECEIPT/);
});
test("two-minute snapshot window and event timing bound the reference without proving atomic state",()=>{
 const inside=evaluateLiquidityCashflows(history({observedAt:"2026-11-19T12:02:00.000Z"}),costs,position()).positionValue;
 assert.equal(inside.status,"REFERENCE_ONLY");assert.equal(inside.snapshotSkewSeconds,120);
 const outside=evaluateLiquidityCashflows(history({observedAt:"2026-11-19T12:02:00.001Z"}),costs,position()).positionValue;
 assert.equal(outside.balanceOnlyReferenceUsd,null);assert.ok(outside.reasons.includes("SNAPSHOT_WINDOW_EXCEEDED"));
 const newerEvent=evaluateLiquidityCashflows(history({blockTime:Math.floor(Date.parse(time)/1000)+1}),costs,position()).positionValue;
 assert.equal(newerEvent.balanceOnlyReferenceUsd,null);assert.ok(newerEvent.reasons.includes("EVENT_AFTER_POSITION_SNAPSHOT"));
});
test("unknown state and nonzero closed components never produce a combined reference",()=>{
 const obs=position().observation;
 const unknown=evaluateLiquidityCashflows(history(),costs,position({range:{...obs.range,state:"UNKNOWN",lowerBinId:null}})).positionValue;
 assert.equal(unknown.balanceOnlyReferenceUsd,null);assert.ok(unknown.reasons.includes("POSITION_STATE_UNCONFIRMED"));
 const closed=evaluateLiquidityCashflows(history(),costs,position({range:{...obs.range,state:"CLOSED",isClosed:true}})).positionValue;
 assert.equal(closed.balanceOnlyReferenceUsd,null);assert.ok(closed.reasons.includes("CLOSED_POSITION_COMPONENTS_NONZERO"));
 const empty={...obs,range:{...obs.range,state:"CLOSED",isClosed:true},tokenX:{...obs.tokenX,principalUsd:"0",unclaimedFeeUsd:"0"},tokenY:{...obs.tokenY,principalUsd:"0",unclaimedFeeUsd:"0"}};
 const zero=evaluateLiquidityCashflows(history(),costs,currentPositionReceipt(empty)).positionValue;
 assert.equal(zero.balanceOnlyReferenceUsd,"5");assert.equal(zero.realizedProfitUsd,null);
});
test("exact decimal balance arithmetic is preserved instead of rounded through Number",()=>{
 const obs=position().observation;
 const snapshot=position({tokenX:{...obs.tokenX,principalUsd:"99999999999999999999999999999999.999999999999999999"},tokenY:{...obs.tokenY,principalUsd:"0.000000000000000001"}});
 const value=evaluateLiquidityCashflows(history(),costs,snapshot).positionValue;
 assert.equal(value.providerBalanceComponentsUsd.total,"100000000000000000000000000000000");
 assert.equal(value.balanceOnlyReferenceAfterEnteredCostsUsd,"100000000000000000000000000000004.5");
});
test("stateless cost API accepts an optional position receipt and rejects a mismatched position",async()=>{
 const body={historyReceipt:history(),costs,positionReceipt:position()};
 const good=await handler({method:"POST",body},res());assert.equal(good.code,200);assert.equal(good.body.cashflows.positionValue.balanceOnlyReferenceAfterEnteredCostsUsd,"144.5");
 const invalid=await handler({method:"POST",body:{...body,positionReceipt:position({queriedUser:mint})}},res());assert.equal(invalid.code,400);
 const legacy=await handler({method:"POST",body:{historyReceipt:history(),costs}},res());assert.equal(legacy.code,200);assert.equal(legacy.body.cashflows.positionValue,null);
});
test("reference view shows observation times and refresh guidance when temporal checks fail",()=>{
 const stale=evaluateLiquidityCashflows(history({observedAt:"2026-11-19T12:03:00.000Z"}),costs,position()).positionValue;
 const html=liquidityPositionValueHtml(stale);assert.match(html,/Refresh the position, then reload its history/);assert.match(html,/unverified balance-only reference/);assert.equal(liquidityPositionValueHtml(null),"");
});
