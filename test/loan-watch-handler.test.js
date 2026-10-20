import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoanWatchHandler } from '../server/guardian/loan-watch.js';
import { LoanWatchError } from '../server/_loan-watch-service.js';

async function call(overrides={},request={}) {
  let calls=0,received;
  const service={manage:async body=>{calls++;received=body;return [];},...overrides.service};
  const handler=createLoanWatchHandler({service,configured:()=>true,enabled:()=>true,...overrides});
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',headers:{},body:{token:'private-token',action:'LIST'},...request},response);
  assert.equal(response.headers['Cache-Control'],'no-store');
  return {...response,calls,received};
}
test('loan watch endpoint rejects methods and disabled gates before management',async()=>{
  for(const method of ['GET','DELETE','PUT']){
    const r=await call({}, {method});assert.equal(r.code,405);assert.equal(r.calls,0);
  }
  for(const overrides of [{enabled:()=>false},{configured:()=>false}]){
    const r=await call(overrides);assert.equal(r.code,503);assert.equal(r.calls,0);
  }
});
test('loan watch endpoint rejects malformed and oversized bodies',async()=>{
  for(const body of ['{','null','[]',42]){
    const r=await call({}, {body});assert.equal(r.code,400);assert.equal(r.calls,0);
  }
  for(const request of [{headers:{'content-length':'4097'}},{body:{token:'x'.repeat(4097)}}]){
    const r=await call({},request);assert.equal(r.code,413);assert.equal(r.calls,0);
  }
});
test('loan watch endpoint forwards only supported fields and never caller-supplied identity',async()=>{
  const r=await call({}, {body:JSON.stringify({token:'private-token',action:'RETRY',loanId:'uuid',consent:true,acceptDuplicate:true,wallet:'attacker',chatId:'-1'})});
  assert.equal(r.code,200);assert.equal(r.calls,1);
  assert.deepEqual(r.received,{token:'private-token',action:'RETRY',loanId:'uuid',consent:true,acceptDuplicate:true});
  assert.ok(!JSON.stringify(r.body).includes('private-token'));
});
test('loan watch endpoint preserves session rejection and quota status codes',async()=>{
  for(const [status,message] of [[401,'Reconnect alerts.'],[429,'Too many watch requests.'],[409,'Delivery changed.']]){
    const r=await call({service:{manage:async()=>{throw new LoanWatchError(message,status);}}});
    assert.equal(r.code,status);assert.deepEqual(r.body,{ok:false,error:message});
  }
});
test('loan watch endpoint hides provider and store exception details',async()=>{
  const r=await call({service:{manage:async()=>{throw Error('PRIVATE_STORE_URL_AND_TOKEN');}}});
  assert.equal(r.code,503);assert.equal(r.body.error,'Unable to update loan watches.');
  assert.ok(!JSON.stringify(r.body).includes('PRIVATE_STORE'));
});
