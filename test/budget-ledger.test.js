import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetLedger } from '../server/_budget-ledger.js';
import { createBudgetHandler } from '../server/bots/budget.js';

const now = () => new Date('2026-10-19T22:30:00Z');
const policy = { perActionCapUsdc:'60',periodCapUsdc:'100',balanceUsdc:'120',reserveUsdc:'20',expiresAt:'2026-10-19T23:30:00Z' };
function fixture() {
  let state=null, loseResponse=false;
  const get=async()=>structuredClone(state);
  const cas=async(_key,expected,next)=>{
    // Yield before the atomic compare/write to exercise competing readers.
    await new Promise(resolve=>setImmediate(resolve));
    if(JSON.stringify(state)!==JSON.stringify(expected))return false;
    state=structuredClone(next);
    if(loseResponse){loseResponse=false;throw Error('response lost after commit');}
    return true;
  };
  const update=createBudgetLedger({get,cas,now});
  return {update,get,loseResponse:()=>{loseResponse=true;}};
}
async function started(f) {
 await f.update({botId:'ddca_bot_01',action:'initialize',policy});
 await f.update({botId:'ddca_bot_01',action:'resume'});
}
const request=(action,operationId,amountUsdc)=>({botId:'ddca_bot_01',action,operationId,amountUsdc});
test('simultaneous reservations cannot exceed a shared authorization budget',async()=>{
 const f=fixture();await started(f);
 const results=await Promise.allSettled([f.update(request('reserve','operation_01','60')),f.update(request('reserve','operation_02','60'))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await f.get()).reservedUnits,'60000000');
});
test('duplicate concurrent IDs and lost responses reserve exactly once',async()=>{
 const f=fixture();await started(f);
 const results=await Promise.all([f.update(request('reserve','operation_01','50')),f.update(request('reserve','operation_01','50'))]);
 assert.equal(results.filter(r=>r.replayed).length,1);
 assert.equal((await f.get()).reservedUnits,'50000000');
 f.loseResponse();await assert.rejects(f.update(request('reserve','operation_02','10')),/response lost/);
 assert.equal((await f.update(request('reserve','operation_02','10'))).replayed,true);
 assert.equal((await f.get()).reservedUnits,'60000000');
 await assert.rejects(f.update(request('reserve','operation_01','51')),/bound/);
});
test('releases are idempotent and cancelled IDs cannot reserve again',async()=>{
 const f=fixture();await started(f);
 await f.update(request('reserve','operation_01','50'));
 await Promise.all([f.update(request('release','operation_01')),f.update(request('release','operation_01'))]);
 assert.equal((await f.get()).reservedUnits,'0');
 await assert.rejects(f.update(request('reserve','operation_01','50')),/released/);
 await assert.rejects(f.update({botId:'ddca_bot_01',action:'initialize',policy}),/overwritten/);
});
test('pause, expiry, caps and bounded retry failures block new reservations',async()=>{
 const f=fixture();await f.update({botId:'ddca_bot_01',action:'initialize',policy});
 await assert.rejects(f.update(request('reserve','operation_01','1')),/paused/);
 await f.update({botId:'ddca_bot_01',action:'resume'});
 await assert.rejects(f.update(request('reserve','operation_01','60.000001')),/limit/);
 const expired=createBudgetLedger({get:f.get,cas:async()=>true,now:()=>new Date('2026-10-20T00:00:00Z')});
 await assert.rejects(expired(request('reserve','operation_01','1')),/expired/);
 const busy=createBudgetLedger({get:async()=>null,cas:async()=>false,now});
 await assert.rejects(busy({botId:'ddca_bot_01',action:'initialize',policy}),/Concurrent/);
 await assert.rejects(createBudgetLedger({get:async()=>null,cas:async()=>true,now})({botId:'ddca_bot_01',action:'initialize',policy:{...policy,periodCapUsdc:'101'}}),/Invalid caps/);
});
const response=()=>({statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}});
test('budget endpoint checks authorization and store readiness before mutation',async()=>{
 let calls=0;
 const handler=createBudgetHandler({update:async()=>{calls++;return {};},configured:()=>true,token:()=> 'secret'});
 let res=response();await handler({method:'POST',headers:{},body:{}},res);assert.equal(res.statusCode,401);assert.equal(calls,0);
 res=response();await handler({method:'POST',headers:{authorization:'Bearer secret'},body:'{'},res);assert.equal(res.statusCode,400);assert.equal(calls,0);
 const offline=createBudgetHandler({configured:()=>false,token:()=> 'secret'});
 res=response();await offline({method:'POST',headers:{authorization:'Bearer secret'},body:{}},res);assert.equal(res.statusCode,503);
});
