import test from "node:test";
import assert from "node:assert/strict";
import { createVaultWatchHandler, runVaultWatches } from "../server/guardian/vault-watch.js";
import { verifyReceiptDocument } from "../packages/evidence/index.js";

const vault = "0x" + "1".repeat(40);
const evidence = (block, share = 50) => ({
  vaultAddress: vault, chainId: 5042, version: 1, status: "INDEXED_OBSERVATION",
  aligned: true, reconciled: true, sourceBlocks: {state: String(block)},
  asset: {address:"0x" + "2".repeat(40), decimals: 6}, roles: {}, positions: [],
  withdrawalCoveragePct: 50, largestPositionPct: share
});
const response = () => ({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
test("vault registration requires operator access, explicit approval and complete Arc evidence", async () => {
  let state = null, reads = 0, baseline = {...evidence(100),aligned:false};
  const handler = createVaultWatchHandler({configured:()=>true,token:()=>"test",load:async()=>state,
    save:async(k, expected, next)=>{assert.equal(expected,state);state=next;return true},
    observe:async()=>{reads++;return baseline}});
  const request = {method:"POST",headers:{},body:{vault}};
  assert.equal((await handler(request,response())).code,401);
  request.headers.authorization="Bearer test";
  assert.equal((await handler(request,response())).code,400);
  assert.equal(reads,0);
  request.body.approveBaseline=true;
  assert.equal((await handler(request,response())).code,422);
  baseline=evidence(100);
  assert.equal((await handler(request,response())).code,200);
  assert.equal(state[0].baseline.sourceBlocks.state,"100");
  assert.equal((await handler({method:"GET",headers:request.headers},response())).body.watches.length,1);
  assert.equal((await handler({method:"DELETE",headers:request.headers,query:{vault}},response())).code,200);
  assert.deepEqual(state,[]);
});
test("scheduled watch seals review evidence, distinguishes partial data and does not replace its baseline",async()=>{
  let state = [{target:vault,baseline:evidence(100),latest:null}];
  const save=async(k,expected,next)=>{assert.equal(expected,state);state=next;return true};
  const run=observe=>runVaultWatches({load:async()=>state,save,observe});
  assert.deepEqual(await run(async()=>evidence(101,60)),{count:1,saved:true});
  assert.equal(state[0].latest.comparison.status,"REVIEW");
  assert.equal(verifyReceiptDocument(state[0].latest).valid,true);
  assert.equal(state[0].latest.automatedAction,false);
  await run(async()=>({...evidence(102),reconciled:false}));
  assert.equal(state[0].latest.comparison.status,"NOT_COMPARABLE");
  await run(async()=>{throw Error("offline")});
  assert.equal(state[0].latest.comparison.status,"UNAVAILABLE");
  assert.equal(state[0].baseline.sourceBlocks.state,"100");
  assert.deepEqual(await runVaultWatches({load:async()=>state,save:async()=>false,observe:async()=>evidence(103)}),{count:1,saved:false});
});
