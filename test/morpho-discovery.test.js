import test from "node:test";
import assert from "node:assert/strict";
import {discoverMorphoMarkets} from "../packages/arc-data/morpho-discovery.js";
import {scoutDiscoveryHtml} from "../packages/agent-modules/scout-discovery-view.js";
import {createDiscoveryHandler} from "../server/scout/discovery.js";
import {createScoutDiscoveryReceipt} from "../packages/evidence/scout-discovery-receipt.js";
import {verifyReceiptDocument} from "../packages/evidence/receipt-registry.js";

const token = "0x"+"a".repeat(40);
const row = id => ({ marketId:"0x"+"b".repeat(64), chain:{id}, listed:true, loanAsset:{address:token,symbol:"USDC"}, collateralAsset:null, state:{liquidityAssetsUsd:"2000",utilization:0.5,supplyApy:0.08} });
const json = items => ({ok:true,json:async()=>({data:{markets:{items}}})});
const requested = options => Number(JSON.parse(options.body).query.match(/chainId_in: \[(\d+)\]/)[1]);

test("discovery preserves per-chain identity even when market hashes repeat", async () => {
  const networks = await discoverMorphoMarkets({chainIds:[5042,8453,1],asset:"usdc",fetcher:async(url,opts)=>{
    assert.equal(url,"https://api.morpho.org/graphql");
    assert.equal(opts.redirect,"error");
    return json([row(requested(opts))]);
  }});
  const markets = networks.flatMap(n=>n.markets);
  assert.equal(new Set(markets.map(m=>m.id)).size,3);
  assert.equal(markets[1].collateral,null);
  assert.equal(markets[1].supplyApyPct,8);
  assert.equal(markets[1].utilizationPct,50);
});
test("wrong chain and upstream outage stay unavailable while an empty filter is no match", async () => {
  const networks = await discoverMorphoMarkets({chainIds:[5042,8453,1],asset:"ETH",fetcher:async(_,opts)=>{
    const id=requested(opts);
    if (id===5042) throw Error("offline");
    return json([row(1)]);
  }});
  assert.deepEqual(networks.map(n=>n.status),["UNAVAILABLE","UNAVAILABLE","NO_MATCH"]);
  assert.equal(networks[2].scanned,1);
});
test("address filter is exact and missing metrics are not represented as zero", async () => {
  const [result] = await discoverMorphoMarkets({chainIds:[8453],asset:token.toUpperCase(),fetcher:async()=>json([{...row(8453),state:{liquidityAssetsUsd:"",utilization:1.2,supplyApy:null}}])});
  const [market]=result.markets;
  assert.equal(market.liquidityUsd,null);
  assert.equal(market.utilizationPct,null);
  assert.equal(market.supplyApyPct,null);
  assert.ok(!scoutDiscoveryHtml({chains:[8453],asset:"<x>",networks:[result]}).includes("<x>"));
});
test("endpoint rejects unrecognized chains and write methods", async () => {
  const res=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
  const handler=createDiscoveryHandler({discover:async()=>{throw Error("should not fetch")}});
  assert.equal((await handler({method:"GET",url:"/api/scout/discovery?chains=999"},res())).code,400);
  assert.equal((await handler({method:"POST"},res())).code,405);
});

test("risk thresholds compose with asset filters and exclude missing metrics", async () => {
  const rows = [
    row(8453),
    {...row(8453),marketId:"0x"+"c".repeat(64),state:{liquidityAssetsUsd:1999,utilization:0.5}},
    {...row(8453),marketId:"0x"+"d".repeat(64),state:{liquidityAssetsUsd:2000,utilization:0.51}},
    {...row(8453),marketId:"0x"+"e".repeat(64),state:{liquidityAssetsUsd:2000,utilization:null}}
  ];
  const [result] = await discoverMorphoMarkets({chainIds:[8453],asset:"USDC",minLiquidityUsd:"2000",maxUtilizationPct:"50",fetcher:async()=>json(rows)});
  assert.equal(result.scanned,4);
  assert.deepEqual(result.markets.map(m=>m.marketId),[rows[0].marketId]);
  await assert.rejects(discoverMorphoMarkets({chainIds:[8453],maxUtilizationPct:"101",fetcher:()=>assert.fail("invalid thresholds must not fetch")}),/threshold/);
});

test("a discovery receipt distinguishes a filtered-out network from a provider outage", async () => {
  const filters = {chains:[8453,1], asset:"USDC", minLiquidityUsd:"3000", maxUtilizationPct:"50"};
  const networks = await discoverMorphoMarkets({
    ...filters, chainIds:filters.chains,
    fetcher:async(_, opts) => requested(opts) === 8453 ? json([row(8453)]) : {ok:false}
  });
  const receipt = JSON.parse(JSON.stringify(createScoutDiscoveryReceipt(filters, networks)));
  assert.equal(verifyReceiptDocument(receipt).valid,true);
  assert.deepEqual(receipt.networks.map(({status,scanned}) => [status,scanned]), [["NO_MATCH",1],["UNAVAILABLE",null]]);
  assert.equal(createScoutDiscoveryReceipt(filters, networks.filter(({id}) => id === 1)),null);
  receipt.filters.minLiquidityUsd = "0";
  assert.equal(verifyReceiptDocument(receipt).valid,false);
});
