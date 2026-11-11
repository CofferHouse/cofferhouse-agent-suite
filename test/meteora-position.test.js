import test from "node:test";
import assert from "node:assert/strict";
import { fetchMeteoraPosition, normalizeMeteoraPosition } from "../packages/arc-data/meteora-position.js";
import { createMeteoraPositionHandler } from "../server/scout/meteora-position.js";
import { meteoraPositionHtml } from "../packages/agent-modules/meteora-position-view.js";
const target = { pool:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6", user:"11111111111111111111111111111111", position:"So11111111111111111111111111111111111111112" };
const other="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const row = () => ({positionAddress:target.position,isClosed:false,lowerBinId:-10,upperBinId:10,poolActiveBinId:0,isOutOfRange:false,pnlUsd:"-12.75",allTimeFees:{total:{usd:"25.00"}},allTimeDeposits:{total:{usd:"1000"}},allTimeWithdrawals:{total:{usd:"0"}},unrealizedPnl:{balanceTokenX:{amount:"12345678901234567890.123456",usd:"800"},balanceTokenY:{amount:"150",usd:"150"},unclaimedFeeTokenX:{amount:"0.005",usd:"5"},unclaimedFeeTokenY:{amount:"3",usd:"3"}}});
const payload=(positions,page=1,hasNext=false)=>({positions,page,hasNext,tokenX:target.position,tokenY:other});

test("position receipts preserve principal and fees separately without recalculating provider PnL",()=>{
 const observation=normalizeMeteoraPosition(row(),payload([]),target);
 assert.equal(observation.id,`solana:mainnet:meteora-dlmm:${target.pool}:${target.position}`);
 assert.equal(observation.providerPnlUsd,"-12.75");
 assert.equal(observation.providerAllTimeFeesUsd,"25.00");
 assert.equal(observation.tokenX.principalAmount,"12345678901234567890.123456");
 assert.equal(observation.tokenX.unclaimedFeeUsd,"5");
 assert.equal(observation.costAdjustedPnlUsd,null);
 assert.equal(observation.holdingBenchmarkUsd,null);
 assert.equal(observation.onchainVerified,false);
 assert.throws(()=>normalizeMeteoraPosition({...row(),positionAddress:other},payload([]),target),/identity/);
});
test("bin checks include boundaries and fail to unknown on inconsistent flags or missing bins",()=>{
 const normalize=r=>normalizeMeteoraPosition({...row(),...r},payload([]),target);
 assert.equal(normalize({poolActiveBinId:-10}).range.state,"IN_RANGE");
 assert.equal(normalize({poolActiveBinId:10}).range.state,"IN_RANGE");
 assert.equal(normalize({poolActiveBinId:11,isOutOfRange:true}).range.state,"OUT_OF_RANGE");
 assert.equal(normalize({poolActiveBinId:11,isOutOfRange:true}).rangeNeedsReview,true);
 assert.equal(normalize({poolActiveBinId:11}).range.state,"UNKNOWN");
 assert.equal(normalize({lowerBinId:null}).range.state,"UNKNOWN");
 assert.equal(normalize({lowerBinId:20,upperBinId:10}).range.state,"UNKNOWN");
 assert.equal(normalize({isClosed:true}).range.state,"CLOSED");
});
test("exact position lookup is case-sensitive, paginated and uses only the documented fixed provider",async()=>{
 const calls=[];
 const result=await fetchMeteoraPosition(target,{fetcher:async(url,opts)=>{
  const parsed=new URL(url);calls.push(parsed);
  assert.equal(parsed.origin,"https://dlmm.datapi.meteora.ag");
  assert.equal(parsed.pathname,`/positions/${target.pool}/pnl`);
  assert.equal(parsed.searchParams.get("user"),target.user);
  assert.equal(opts.redirect,"error");assert.equal(opts.method,"GET");
  const page=Number(parsed.searchParams.get("page"));
  return {ok:true,json:async()=>page===1 ? payload([{positionAddress:other}],1,true):payload([row()],2)};
 }});
 assert.equal(calls.length,2);assert.equal(result.status,"FOUND");
 assert.equal(result.pagesScanned,2);assert.equal(result.observation.position,target.position);
});
test("truncation, absence and source failure never imply a position was closed",async()=>{
 const empty=await fetchMeteoraPosition(target,{fetcher:async()=>({ok:true,json:async()=>payload([])})});
 assert.equal(empty.status,"NOT_OBSERVED");assert.equal(empty.observation,null);
 const limited=await fetchMeteoraPosition(target,{fetcher:async url=>({ok:true,json:async()=>payload([],Number(new URL(url).searchParams.get("page")),true)})});
 assert.equal(limited.status,"NOT_FOUND_IN_SAMPLE");assert.equal(limited.pagesScanned,3);
 for(const fetcher of [async()=>({ok:false}),async()=>({ok:true,json:async()=>payload([row(),row()])}),async()=>{throw Error("private provider detail");}]) {
  const result=await fetchMeteoraPosition(target,{fetcher});assert.equal(result.status,"UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("private provider detail"),false);
 }
});
test("position endpoint accepts explicit reads only and never forwards unknown body fields",async()=>{
 let count=0;
 const handler=createMeteoraPositionHandler({read:async input=>{count++;assert.deepEqual(input,target);return {status:"NOT_OBSERVED",observation:null};}});
 const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 assert.equal((await handler({method:"GET"},res())).code,405);
 assert.equal((await handler({method:"POST",body:{...target,pool:"http://localhost"}},res())).code,400);
 assert.equal(count,0);
 assert.equal((await handler({method:"POST",body:{...target,apiKey:"do-not-forward"}},res())).code,200);
 const html=meteoraPositionHtml({pool:"<img>",user:"",position:"",result:{status:"NOT_OBSERVED"}});
 assert.equal(html.includes("<img>"),false);assert.equal(html.includes("meteora-position-download"),false);
});
