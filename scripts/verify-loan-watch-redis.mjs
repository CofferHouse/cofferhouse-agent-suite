// Explicit CI integration: never run against a production Redis account.
// Production Lua commands are transported through docker exec to an isolated
// Redis service. This validates Redis semantics, not Upstash REST/TLS behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { getJson,setJson,compareAndSetJson,consumeLoanWatchRequest } from '../server/_redis.js';
import { createLoanWatchService } from '../server/_loan-watch-service.js';

const container=process.env.REDIS_TEST_CONTAINER;
if(!/^[a-f0-9]{12,64}$/.test(container??''))throw Error('An explicit isolated Redis service container ID is required.');
const execute=promisify(execFile),originalFetch=globalThis.fetch;
const originalUrl=process.env.UPSTASH_REDIS_REST_URL,originalToken=process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.UPSTASH_REDIS_REST_URL='https://cofferhouse-redis-test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN='isolated-ci-placeholder-not-a-credential';
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://cofferhouse-redis-test.invalid');
  const command=JSON.parse(options.body);
  const {stdout}=await execute('docker',['exec',container,'redis-cli','--json',...command.map(String)],{signal:options.signal,timeout:5000,maxBuffer:1024*1024});
  const result=JSON.parse(stdout);
  return {ok:true,json:async()=>({result})};
};
test.after(()=>{
  globalThis.fetch=originalFetch;
  if(originalUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=originalUrl;
  if(originalToken===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=originalToken;
});

test('real Redis CAS admits one concurrent writer and preserves exact integers',{timeout:30000},async()=>{
  const key='ci:cas:'+randomUUID();
  const results=await Promise.all(Array.from({length:12},(_,i)=>compareAndSetJson(key,null,{writer:i,units:'9007199254740993'})));
  assert.equal(results.filter(Boolean).length,1);
  const stored=await getJson(key);assert.equal(stored.units,'9007199254740993');
  assert.equal(await compareAndSetJson(key,{writer:-1},{}),false);
  assert.equal(await compareAndSetJson(key,stored,{revision:2}),true);
  assert.deepEqual(await getJson(key),{revision:2});
});
test('real Redis quota allows exactly twenty requests across concurrent clients',{timeout:30000},async()=>{
  const wallet='ci-'+randomUUID();
  const batch=()=>Promise.all(Array.from({length:12},()=>consumeLoanWatchRequest(wallet)));
  const results=[...await batch(),...await batch()];
  assert.equal(results.filter(Boolean).length,20);
  const {stdout}=await execute('docker',['exec',container,'redis-cli','--json','TTL','cofferhouse:guardian:watch-rate:'+wallet]);
  const ttl=JSON.parse(stdout);assert.ok(ttl>0&&ttl<=60);
});
test('real Redis coordinates registration, delivery, claimed recovery and removal',{timeout:60000},async()=>{
  const wallet='0x'+'1'.repeat(40),loanId='11111111-1111-4111-8111-111111111111';
  const token='a'.repeat(32),linkedAt='2026-10-20T17:00:00Z',registry='cofferhouse:guardian:loan-watches:v1';
  await setJson('cofferhouse:alerts:telegram:status:'+token,{status:'CONNECTED',walletAddress:wallet,linkedAt});
  await setJson('cofferhouse:alerts:telegram:wallet:'+wallet,{schema:'cofferhouse.telegram.subscription.v1',walletAddress:wallet,linkedAt,active:true,chatId:'123',telegramUserId:'123',preferences:{guardianAttention:true}});
  await setJson('cofferhouse:alerts:telegram:chat:123',{walletAddress:wallet,linkedAt});
  let clock=Date.parse(linkedAt),messages=0;
  const service=createLoanWatchService({
    get:getJson,cas:compareAndSetJson,consume:consumeLoanWatchRequest,id:randomUUID,now:()=>new Date(clock),maxRunMs:30000,
    getPosition:async()=>({loanId,wallet,chain:'Arc'}),
    evaluate:()=>({decision:'HUMAN_ATTENTION',healthFactorBand:'WARN'}),
    send:async()=>{messages++;return {delivered:true};}
  });
  const manage=(action,extra={})=>service.manage({token,loanId,action,consent:true,...extra});
  await manage('ADD');
  await Promise.all([service.run(),service.run(),service.run()]);
  assert.equal(messages,1);
  const [watch]=await getJson(registry),stateKey='cofferhouse:guardian:loan-watch-state:'+watch.id;
  const delivered=await getJson(stateKey);assert.equal(delivered.delivery,'DELIVERED');
  await setJson(stateKey,{...delivered,delivery:'CLAIMED'}); // persisted-crash fixture
  clock+=600000;
  const retries=await Promise.allSettled([manage('RETRY',{acceptDuplicate:true}),manage('RETRY',{acceptDuplicate:true})]);
  assert.equal(retries.filter(r=>r.status==='fulfilled').length,1);
  await Promise.all([service.run(),service.run(),service.run()]);
  assert.equal(messages,2);assert.equal((await getJson(stateKey)).delivery,'DELIVERED');
  await manage('REMOVE');await service.run();assert.equal(messages,2);
  assert.deepEqual(await getJson(registry),[]);
});
