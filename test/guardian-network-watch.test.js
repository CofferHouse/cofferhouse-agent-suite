import test from "node:test";
import assert from "node:assert/strict";
import {observeNetworkWatch,createNetworkWatchHandler,runNetworkWatches} from "../server/guardian/network-watch.js";
import {networkMarketIdentity,fetchNetworkMarket} from "../packages/arc-data/morpho-network-target.js";
import {verifyReceiptDocument} from "../packages/evidence/index.js";
const marketId="0x"+"a".repeat(64), asset="0x"+"b".repeat(40);
const market=chainId=>({id:networkMarketIdentity(chainId,marketId),chainId,marketId,listed:true,liquidityUsd:2000,utilizationPct:50,asset:{address:asset},collateral:null});
const watch=chainId=>({...market(chainId),baseline:market(chainId),limits:{minLiquidityUsd:1000,maxUtilizationPct:80}});
test("watch thresholds review deterioration and fail closed on a wrong network",async()=>{
 const w=watch(8453);
 const receipt=await observeNetworkWatch(w,{observe:async()=>({...market(8453),liquidityUsd:900,utilizationPct:90})});
 assert.equal(receipt.status,"REVIEW");
 assert.deepEqual(receipt.reasons,["LIQUIDITY_BELOW_MINIMUM","UTILIZATION_ABOVE_MAXIMUM"]);
 assert.equal(verifyReceiptDocument(receipt).valid,true);
 assert.equal(receipt.automatedAction,false);
 assert.equal((await observeNetworkWatch(w,{observe:async()=>market(1)})).status,"UNAVAILABLE");
 assert.equal((await observeNetworkWatch(w,{observe:async()=>({...market(8453),liquidityUsd:null})})).status,"INCOMPLETE");
 assert.equal((await observeNetworkWatch(w,{observe:async()=>market(8453)})).status,"WITHIN_LIMITS");
});
test("watch can review an unlisted target and source failures are not disappearance",async()=>{
 assert.equal((await observeNetworkWatch(watch(1),{observe:async()=>({...market(1),listed:false})})).status,"REVIEW");
 const unavailable=await observeNetworkWatch(watch(1),{observe:async()=>{throw Error("API offline")}});
 assert.equal(unavailable.status,"UNAVAILABLE");
 assert.equal(unavailable.current,null);
});
test("protected registry keeps identical market hashes on separate chains and uses CAS",async()=>{
 let state=null, allowSave=true;
 const handler=createNetworkWatchHandler({token:()=>"test",configured:()=>true,load:async()=>state,save:async(k,expected,next)=>{assert.equal(expected,state);if(!allowSave)return false;state=next;return true},observe:async t=>market(t.chainId)});
 const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
 const request=chainId=>({method:"POST",url:"/",headers:{authorization:"Bearer test"},body:{chainId,marketId,approveBaseline:true,limits:{minLiquidityUsd:1000,maxUtilizationPct:80}}});
 assert.equal((await handler({...request(1),headers:{}},response())).code,401);
 assert.equal((await handler(request(8453),response())).code,200);
 assert.equal((await handler(request(1),response())).code,200);
 assert.equal(state.length,2);
 allowSave=false;
 assert.equal((await handler(request(5042),response())).code,409);
 assert.equal(state.length,2);
 const bad=request(8453);bad.body.limits.maxUtilizationPct="80";
 assert.equal((await handler(bad,response())).code,400);
});
test("scheduled network watch does not resurrect removed registrations on CAS failure",async()=>{
 const w=watch(8453);
 const result=await runNetworkWatches({load:async()=>[w],save:async()=>false,observe:async()=>market(8453)});
 assert.deepEqual(result,{count:1,saved:false});
});
test("exact network lookup uses target chain and rejects an unexpected market",async()=>{
 const target={chainId:8453,marketId};
 let calls=0;
 const fetcher=async(url,options)=>{
  calls++;assert.equal(url,"https://api.morpho.org/graphql");assert.equal(options.redirect,"error");
  const body=JSON.parse(options.body);assert.match(body.query,/chainId: 8453/);
  return {ok:true,json:async()=>({data:{marketById:{chain:{id:8453},marketId,listed:false,loanAsset:{address:asset,symbol:"USDC"},collateralAsset:null,state:{liquidityAssetsUsd:2000,utilization:0.5,supplyApy:0.05}}}})};
 };
 assert.equal((await fetchNetworkMarket(target,{fetcher})).listed,false);
 await assert.rejects(fetchNetworkMarket({...target,chainId:999},{fetcher}));
 assert.equal(calls,1);
});
