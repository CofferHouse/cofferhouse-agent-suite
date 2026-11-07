import test from "node:test";
import assert from "node:assert/strict";
import {isSolanaPublicKey,normalizeJupiterEarnTokens,fetchJupiterEarnTokens} from "../packages/arc-data/jupiter-lend.js";
import {createSolanaDiscoveryHandler} from "../server/scout/solana.js";
import {solanaDiscoveryHtml} from "../packages/agent-modules/solana-discovery-view.js";
const mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const lending="So11111111111111111111111111111111111111112";
const row=()=>({address:lending,assetAddress:mint,asset:{address:mint,symbol:"USDC",decimals:6},totalAssets:"12345678901234567890",totalSupply:"1000000",supplyRate:"250",rewardsRate:"100",totalRate:"350"});
test("Jupiter preserves Solana identities and raw units without asserting APY or exit liquidity",()=>{
 const [token]=normalizeJupiterEarnTokens([row()]);
 assert.equal(token.asset.mint,mint);
 assert.equal(token.totalAssetsUnits,"12345678901234567890");
 assert.equal(token.providerRates.supply,"250");
 assert.equal(token.supplyApyPct,null);
 assert.equal(token.withdrawableLiquidityUsd,null);
 assert.equal(token.rateUnitsVerified,false);
 assert.equal(isSolanaPublicKey(mint),true);
 assert.equal(isSolanaPublicKey("0x"+"a".repeat(40)),false);
 assert.equal(isSolanaPublicKey("1".repeat(33)),false);
});
test("Jupiter rejects duplicate, wrong or inconsistent identities",()=>{
 assert.throws(()=>normalizeJupiterEarnTokens([row(),row()]),/identity/);
 assert.throws(()=>normalizeJupiterEarnTokens([{...row(),assetAddress:lending}]),/identity/);
 assert.throws(()=>normalizeJupiterEarnTokens({data:[row()]}),/list/);
 assert.throws(()=>normalizeJupiterEarnTokens([{...row(),asset:{address:mint,symbol:"USDC",decimals:null}}]),/asset/);
 const [token]=normalizeJupiterEarnTokens([{...row(),totalAssets:100,supplyRate:"NaN"}]);
 assert.equal(token.totalAssetsUnits,null);
 assert.equal(token.providerRates.supply,null);
});
test("unconfigured adapter never makes a request and does not expose an API credential",async()=>{
 let calls=0;
 const result=await fetchJupiterEarnTokens({fetcher:()=>{calls++}});
 assert.equal(result.status,"NOT_CONFIGURED");assert.equal(calls,0);
 const good=await fetchJupiterEarnTokens({apiKey:"test-secret",fetcher:async(url,options)=>{
  assert.equal(url,"https://api.jup.ag/lend/v1/earn/tokens");
  assert.equal(options.method,"GET");assert.equal(options.redirect,"error");
  assert.equal(options.headers["x-api-key"],"test-secret");
  return {ok:true,json:async()=>[row()]};
 }});
 assert.equal(good.status,"FOUND");assert.equal(JSON.stringify(good).includes("test-secret"),false);
 for(const status of [401,429,500])assert.equal((await fetchJupiterEarnTokens({apiKey:"test",fetcher:async()=>({ok:false,status})})).status,"UNAVAILABLE");
});
test("Jupiter enforces a deadline and an invalid upstream response stays unavailable",async()=>{
 const r=await fetchJupiterEarnTokens({apiKey:"test",timeoutMs:1,fetcher:async(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener("abort",()=>reject(Error("timeout"))))});
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal((await fetchJupiterEarnTokens({apiKey:"test",fetcher:async()=>({ok:true,json:async()=>({})})})).status,"UNAVAILABLE");
});
test("Solana endpoint refuses writes and the panel escapes token symbols",async()=>{
 const response={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 const handler=createSolanaDiscoveryHandler({key:()=>undefined});
 await handler({method:"POST"},response);assert.equal(response.code,405);
 await handler({method:"GET"},response);assert.equal(response.body.status,"NOT_CONFIGURED");
 const [token]=normalizeJupiterEarnTokens([{...row(),asset:{address:mint,symbol:"<img>",decimals:6}}]);
 assert.equal(solanaDiscoveryHtml({mode:"ready",status:"FOUND",tokens:[token]}).includes("<img>"),false);
});
