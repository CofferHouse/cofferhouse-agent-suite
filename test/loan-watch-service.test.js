import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoanWatchService } from '../server/_loan-watch-service.js';

const loanId='11111111-1111-4111-8111-111111111111',otherLoan='22222222-2222-4222-8222-222222222222';
const wallet='0x'+'1'.repeat(40),otherWallet='0x'+'2'.repeat(40),token='a'.repeat(32),linkedAt='2026-10-20T17:00:00Z';
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture() {
  const data=new Map(),messages=[];
  let requestCount=0;
  let clock=Date.parse(linkedAt),sequence=0,failProvider=false,failSend=false,onObserve=()=>{};
  let position={loanId,wallet,chain:'Arc',healthFactor:1.15};
  data.set('cofferhouse:alerts:telegram:status:'+token,{status:'CONNECTED',walletAddress:wallet,linkedAt});
  data.set('cofferhouse:alerts:telegram:wallet:'+wallet,{schema:'cofferhouse.telegram.subscription.v1',walletAddress:wallet,linkedAt,active:true,chatId:'123',telegramUserId:'123',preferences:{guardianAttention:true}});
  data.set('cofferhouse:alerts:telegram:chat:123',{walletAddress:wallet,linkedAt});
  const get=async key=>data.has(key)?clone(data.get(key)):null;
  const cas=async(key,expected,next)=>{await Promise.resolve();if(JSON.stringify(data.has(key)?data.get(key):null)!==JSON.stringify(expected))return false;data.set(key,clone(next));return true;};
  const service=createLoanWatchService({get,cas,consume:async()=>++requestCount<=20,now:()=>new Date(clock),id:()=> '00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),
    getPosition:async args=>{onObserve();if(failProvider)throw Error('PRIVATE_PROVIDER_ERROR');return {...position,loanId:args.loanId};},
    evaluate:({position:p})=>({decision:p.healthFactor>=1.2?'MONITOR':'HUMAN_ATTENTION',healthFactorBand:p.healthFactor>=1.2?'SAFE':p.healthFactor>=1.1?'WARN':'URGENT'}),
    send:async request=>{messages.push(request);if(failSend)throw Error('ambiguous timeout');return {delivered:true};}
  });
  const manage=(action='ADD',extra={})=>service.manage({token,loanId,action,consent:true,...extra});
  const sub=()=>data.get('cofferhouse:alerts:telegram:wallet:'+wallet);
  return {service,manage,data,messages,sub,setPosition:p=>{position={...position,...p};},advance:ms=>{clock+=ms;},restoreSend:()=>{failSend=false;},failProvider:()=>{failProvider=true;},failSend:()=>{failSend=true;},slow:()=>{onObserve=()=>{clock+=16000;};}};
}
test('watch registration requires consent and provider ownership, and lists only the connected wallet',async()=>{
  const f=fixture();
  await assert.rejects(f.manage('ADD',{consent:false}),/consent/);
  f.setPosition({wallet:otherWallet});await assert.rejects(f.manage(),/does not match/);
  f.setPosition({wallet});const result=await f.manage();assert.equal(result.registered,true);
  assert.equal((await f.manage()).replayed,true);
  assert.equal((await f.manage('LIST')).length,1);
  const summary=await f.service.run();assert.equal(summary.alerted,1);assert.equal(f.messages[0].chatId,'123');
  assert.ok(!JSON.stringify(summary).includes(wallet));
});
test('group chats, reassigned chats and old connection tokens cannot manage private loan watches',async()=>{
  let f=fixture();f.sub().chatId='-123';await assert.rejects(f.manage(),/private Telegram/);
  f=fixture();f.data.set('cofferhouse:alerts:telegram:chat:123',{walletAddress:otherWallet,linkedAt});await assert.rejects(f.manage(),/private Telegram/);
  f=fixture();f.sub().linkedAt='2026-10-20T17:01:00Z';await assert.rejects(f.manage(),/private Telegram/);
});
test('same health band is delivered once, with a new warning after a recovery',async()=>{
  const f=fixture();await f.manage();await f.service.run();await f.service.run();assert.equal(f.messages.length,1);
  f.setPosition({healthFactor:1.3});await f.service.run();assert.equal(f.messages.length,1);
  f.setPosition({healthFactor:1.15});await f.service.run();assert.equal(f.messages.length,2);
  f.setPosition({healthFactor:1.05});await f.service.run();assert.equal(f.messages.length,3);
});
test('Guardian opt-out, disconnect and removal prevent subsequent loan delivery',async()=>{
  const f=fixture();await f.manage();f.sub().preferences.guardianAttention=false;
  await f.service.run();assert.equal(f.messages.length,0);
  f.sub().preferences.guardianAttention=true;f.sub().active=false;await f.service.run();assert.equal(f.messages.length,0);
  f.sub().active=true;await f.manage('REMOVE');await f.service.run();assert.equal(f.messages.length,0);
});
test('foreign provider positions and provider failures never leak financial details',async()=>{
  const f=fixture();await f.manage();f.setPosition({wallet:otherWallet,healthFactor:0.1});
  await f.service.run();assert.ok(f.messages[0].text.includes('UNAVAILABLE'));assert.ok(!f.messages[0].text.includes(otherWallet));
  f.failProvider();await f.service.run();assert.equal(f.messages.length,1);assert.ok(!f.messages[0].text.includes('PRIVATE_PROVIDER_ERROR'));
});
test('concurrent cycles claim the same transition only once',async()=>{
  const f=fixture();await f.manage();await Promise.all([f.service.run(),f.service.run()]);assert.equal(f.messages.length,1);
});
test('ambiguous Telegram outcomes remain held and are not automatically retried',async()=>{
  const f=fixture();await f.manage();f.failSend();const first=await f.service.run();assert.equal(first.held,1);
  await f.service.run();assert.equal(f.messages.length,1);
  assert.ok([...f.data.values()].some(value=>value?.delivery==='UNKNOWN'));
});
test('time-budgeted cycles rotate the next watch rather than starving it',async()=>{
  const f=fixture();await f.manage();await f.manage('ADD',{loanId:otherLoan});f.slow();
  const first=await f.service.run();assert.equal(first.deferred,1);
  const second=await f.service.run();assert.equal(second.deferred,1);
  assert.equal(f.messages.length,2);assert.ok(f.messages[1].text.includes(otherLoan.slice(0,8)));
});

test('wallet request quota rejects excess calls before provider work',async()=>{
  const f=fixture();
  for(let i=0;i<20;i++)await f.manage('LIST');
  await assert.rejects(f.manage(),error=>error.status===429);
});
test('unknown delivery is visible and needs explicit duplicate acceptance and cooldown',async()=>{
  const f=fixture();await f.manage();f.failSend();await f.service.run();
  assert.equal((await f.manage('LIST'))[0].delivery,'UNKNOWN');
  await assert.rejects(f.manage('RETRY'),/acceptance/);
  await assert.rejects(f.manage('RETRY',{acceptDuplicate:true}),/ten minutes/);
  f.advance(600000);
  await f.manage('RETRY',{acceptDuplicate:true});
  f.restoreSend();
  await Promise.all([f.service.run(),f.service.run()]);
  assert.equal(f.messages.length,2);
  assert.equal((await f.manage('LIST'))[0].delivery,'DELIVERED');
  await assert.rejects(f.manage('RETRY',{acceptDuplicate:true}),/once/);
});
test('failed manual retry cannot repeat indefinitely within the same band',async()=>{
  const f=fixture();await f.manage();f.failSend();await f.service.run();f.advance(600000);
  await f.manage('RETRY',{acceptDuplicate:true});await f.service.run();f.advance(600000);
  await assert.rejects(f.manage('RETRY',{acceptDuplicate:true}),/once/);
  assert.equal(f.messages.length,2);
});
test('retry rechecks current health and revocation before any send',async()=>{
  let f=fixture();await f.manage();f.failSend();await f.service.run();f.advance(600000);
  await f.manage('RETRY',{acceptDuplicate:true});f.setPosition({healthFactor:1.3});await f.service.run();
  assert.equal(f.messages.length,1);
  f=fixture();await f.manage();f.failSend();await f.service.run();f.advance(600000);
  await f.manage('RETRY',{acceptDuplicate:true});f.sub().active=false;await f.service.run();
  assert.equal(f.messages.length,1);
});
