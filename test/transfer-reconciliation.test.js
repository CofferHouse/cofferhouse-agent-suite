import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, encodeEventTopics, encodeAbiParameters, parseAbi } from 'viem';
import { createTransferReconciler } from '../server/_transfer-reconciliation.js';
import { createBudgetLedger } from '../server/_budget-ledger.js';
const abi=parseAbi(['function transfer(address to, uint256 amount) returns (bool)','event Transfer(address indexed from, address indexed to, uint256 value)']);
const from=`0x${'1'.repeat(40)}`,to=`0x${'2'.repeat(40)}`,token=`0x${'3'.repeat(40)}`,hash=`0x${'4'.repeat(64)}`,blockHash=`0x${'5'.repeat(64)}`;
const tracking={from,to,token,hash,chainId:5042};
const operation={amountUnits:'50000000',transaction:tracking};
function clientFixture(){
 const tx={hash,from,to:token,input:encodeFunctionData({abi,functionName:'transfer',args:[to,50000000n]}),value:0n,blockHash,blockNumber:10n};
 const receipt={transactionHash:hash,status:'success',blockHash,blockNumber:10n,logs:[{address:token,topics:encodeEventTopics({abi,eventName:'Transfer',args:{from,to}}),data:encodeAbiParameters([{type:'uint256'}],[50000000n])}]};
 const client={getChainId:async()=>5042,getTransaction:async()=>tx,getTransactionReceipt:async()=>receipt,getBlockNumber:async()=>11n,getBlock:async()=>({hash:blockHash})};
 return {tx,receipt,client};
}
test('reconciler binds chain, sender, calldata, USDC logs and canonical block',async()=>{
 const f=clientFixture();const reconcile=createTransferReconciler({client:f.client,chainId:5042,token});
 assert.equal((await reconcile(operation)).state,'CONFIRMED');
 f.tx.from=to;assert.equal((await reconcile(operation)).state,'REVIEW');f.tx.from=from;
 f.tx.input='0x';assert.equal((await reconcile(operation)).state,'REVIEW');f.tx.input=encodeFunctionData({abi,functionName:'transfer',args:[to,50000000n]});
 f.receipt.logs[0].data=encodeAbiParameters([{type:'uint256'}],[49999999n]);assert.equal((await reconcile(operation)).state,'REVIEW');
 f.client.getChainId=async()=>1;assert.equal((await reconcile(operation)).state,'REVIEW');
});
test('missing confirmations, reorganized blocks and unavailable RPC retain reservations',async()=>{
 const f=clientFixture();const reconcile=createTransferReconciler({client:f.client,chainId:5042,token});
 f.client.getBlockNumber=async()=>10n;assert.equal((await reconcile(operation)).state,'PENDING');
 f.client.getBlockNumber=async()=>11n;f.client.getBlock=async()=>({hash:`0x${'6'.repeat(64)}`});assert.equal((await reconcile(operation)).state,'PENDING');
 f.client.getTransactionReceipt=async()=>{throw Error('not found');};assert.equal((await reconcile(operation)).state,'PENDING');
});
test('only a matching confirmed reverted transaction releases the transfer amount',async()=>{
 const f=clientFixture();const reconcile=createTransferReconciler({client:f.client,chainId:5042,token});
 f.receipt.status='reverted';f.receipt.logs=[];
 assert.equal((await reconcile(operation)).state,'FAILED');
 f.tx.input='0x';assert.equal((await reconcile(operation)).state,'REVIEW');
});
async function ledgerFixture(){
 let state=null,result={state:'PENDING',reason:'waiting'};
 const get=async()=>structuredClone(state);
 const cas=async(_key,expected,next)=>{await new Promise(resolve=>setImmediate(resolve));if(JSON.stringify(state)!==JSON.stringify(expected))return false;state=structuredClone(next);return true;};
 const update=createBudgetLedger({get,cas,now:()=>new Date('2026-10-19T22:00:00Z'),reconcile:async()=>result});
 const call=(action,extra={})=>update({botId:'ddca_bot_01',operationId:'operation_01',action,...extra});
 await call('initialize',{policy:{perActionCapUsdc:'60',periodCapUsdc:'100',balanceUsdc:'120',reserveUsdc:'20',expiresAt:'2026-10-19T23:00:00Z'}});
 await call('resume');await call('reserve',{amountUsdc:'50'});await call('track',{transaction:tracking});
 return {call,get,setResult:r=>{result=r;},update};
}
test('pending and uncertain operations cannot be released or rebound',async()=>{
 const f=await ledgerFixture();
 await assert.rejects(f.call('release'),/cannot be manually/);
 await assert.rejects(f.call('track',{transaction:{...tracking,hash:`0x${'7'.repeat(64)}`}}),/another transaction/);
 assert.equal((await f.call('track',{transaction:tracking})).replayed,true);
 assert.equal((await f.call('reconcile')).reservedUsdc,'50.000000');
 f.setResult({state:'REVIEW'});assert.equal((await f.call('reconcile')).reservedUsdc,'50.000000');
});
test('concurrent confirmations count spending once and preserve period limits',async()=>{
 const f=await ledgerFixture();f.setResult({state:'CONFIRMED'});
 await Promise.all([f.call('reconcile'),f.call('reconcile')]);
 const state=await f.get();assert.equal(state.reservedUnits,'0');assert.equal(state.spentUnits,'50000000');
 await assert.rejects(f.update({botId:'ddca_bot_01',operationId:'operation_02',action:'reserve',amountUsdc:'60'}),/limit/);
 await f.update({botId:'ddca_bot_01',operationId:'operation_02',action:'reserve',amountUsdc:'10'});
 await assert.rejects(f.update({botId:'ddca_bot_01',operationId:'operation_02',action:'track',transaction:tracking}),/already bound/);
});
test('verified failure releases once and never increments settled spending',async()=>{
 const f=await ledgerFixture();f.setResult({state:'FAILED'});
 await Promise.all([f.call('reconcile'),f.call('reconcile')]);
 assert.equal((await f.get()).reservedUnits,'0');assert.equal((await f.get()).spentUnits??'0','0');
 await assert.rejects(f.call('release'),/cannot be manually/);
});

test('reserved object-property names cannot corrupt idempotency history',async()=>{
 const f=await ledgerFixture();
 for(const operationId of ['__proto__','constructor','prototype']) await assert.rejects(f.update({botId:'ddca_bot_01',operationId,action:'reserve',amountUsdc:'1'}),/operation ID/);
 assert.equal((await f.get()).reservedUnits,'50000000');
});
