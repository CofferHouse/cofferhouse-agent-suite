import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, encodeEventTopics, encodeAbiParameters, parseAbi } from 'viem';
import { validateSwapIntent, createSwapReconciler, reconcileConfiguredSwap } from '../server/_swap-reconciliation.js';
import { createBudgetLedger } from '../server/_budget-ledger.js';
const from=`0x${'1'.repeat(40)}`,router=`0x${'2'.repeat(40)}`,tokenIn=`0x${'3'.repeat(40)}`,tokenOut=`0x${'4'.repeat(40)}`,pool=`0x${'9'.repeat(40)}`,hash=`0x${'5'.repeat(64)}`,blockHash=`0x${'6'.repeat(64)}`;
const now=()=>new Date('2026-10-20T00:00:00Z');
const raw={kind:'SWAP',from,recipient:from,router,tokenIn,tokenOut,chainId:5042,adapter:'fixture_only',maxInputUnits:'50000000',minOutputUnits:'1000000000000000000',calldataHash:keccak256('0x1234'),expiresAt:'2026-10-20T00:03:00Z'};
const intent=validateSwapIntent(raw,50000000n,now());
const tracking={kind:'SWAP',hash,chainId:5042,from,to:router};
const op={amountUnits:'50000000',swapIntent:intent,transaction:tracking};
const abi=parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const log=(address,from,to,value)=>({address,topics:encodeEventTopics({abi,eventName:'Transfer',args:{from,to}}),data:encodeAbiParameters([{type:'uint256'}],[value])});
function fixture(){
 const tx={hash,from,to:router,input:'0x1234',value:0n,blockNumber:10n,blockHash};
 const receipt={transactionHash:hash,status:'success',blockNumber:10n,blockHash,logs:[log(tokenIn,from,pool,50000000n),log(tokenOut,pool,from,2000000000000000000n)]};
 const block={hash:blockHash,timestamp:BigInt(now().getTime()/1000)};
 const client={getChainId:async()=>5042,getTransaction:async()=>tx,getTransactionReceipt:async()=>receipt,getBlockNumber:async()=>11n,getBlock:async()=>block};
 // Test-only adapter exercises the boundary, not a production DEX decoder.
 const adapter={verify:async()=>true};
 const verify=createSwapReconciler({client,chainId:5042,usdc:tokenIn,routers:[router],outputTokens:[tokenOut],adapters:{fixture_only:adapter}});
 return {tx,receipt,block,client,adapter,verify};
}
test('swap intents bind tokens, raw-unit limits, calldata and short-lived quote',()=>{
 assert.equal(intent.tokenOut,tokenOut);
 for(const patch of [{minOutputUnits:'0'},{maxInputUnits:'50000001'},{tokenOut:tokenIn},{expiresAt:'2026-10-19T23:00:00Z'},{expiresAt:'2026-10-20T01:00:00Z'},{calldataHash:'0x12'}]) assert.throws(()=>validateSwapIntent({...raw,...patch},50000000n,now()));
});
test('production swaps fail closed and unknown adapters never read RPC',async()=>{
 assert.equal((await reconcileConfiguredSwap(op)).state,'REVIEW');
 let calls=0;const verify=createSwapReconciler({client:{getChainId:async()=>{calls++;return 5042;}},chainId:5042,usdc:tokenIn,routers:[router],outputTokens:[tokenOut]});
 assert.equal((await verify(op)).state,'REVIEW');assert.equal(calls,0);
});
test('net swap movements enforce budget and minimum output with integer precision',async()=>{
 const f=fixture();let result=await f.verify(op);assert.equal(result.state,'CONFIRMED');assert.equal(result.spentUnits,'50000000');
 f.receipt.logs.push(log(tokenIn,pool,from,10000000n));result=await f.verify(op);assert.equal(result.spentUnits,'40000000');
 f.receipt.logs=[log(tokenIn,from,pool,50000001n),log(tokenOut,pool,from,2000000000000000000n)];assert.equal((await f.verify(op)).state,'REVIEW');
 f.receipt.logs=[log(tokenIn,from,pool,50000000n),log(tokenOut,pool,from,999999999999999999n)];assert.equal((await f.verify(op)).state,'REVIEW');
});
test('calldata, router, recipient flows, expiry and protocol proof must match',async()=>{
 let f=fixture();f.tx.input='0xabcd';assert.equal((await f.verify(op)).state,'REVIEW');
 f=fixture();f.tx.to=pool;assert.equal((await f.verify(op)).state,'REVIEW');
 f=fixture();f.receipt.logs[1]=log(tokenOut,pool,router,2000000000000000000n);assert.equal((await f.verify(op)).state,'REVIEW');
 f=fixture();f.block.timestamp+=181n;assert.equal((await f.verify(op)).state,'REVIEW');
 f=fixture();f.adapter.verify=async()=>false;assert.equal((await f.verify(op)).state,'REVIEW');
});
test('RPC failure and reorg retain funds; only matching reverted swaps release',async()=>{
 let f=fixture();f.client.getBlock=async()=>({hash:`0x${'7'.repeat(64)}`});assert.equal((await f.verify(op)).state,'PENDING');
 f=fixture();f.client.getTransactionReceipt=async()=>{throw Error('timeout');};assert.equal((await f.verify(op)).state,'PENDING');
 f=fixture();f.receipt.status='reverted';f.receipt.logs=[];assert.equal((await f.verify(op)).state,'FAILED');
 f.adapter.verify=async()=>false;assert.equal((await f.verify(op)).state,'REVIEW');
});
async function ledgerFixture(result){
 let state=null;
 const update=createBudgetLedger({get:async()=>structuredClone(state),cas:async(_key,expected,next)=>{if(JSON.stringify(state)!==JSON.stringify(expected))return false;state=structuredClone(next);return true;},now,reconcile:async()=>result});
 const call=(action,extra={})=>update({botId:'ddca_bot_01',operationId:'operation_01',action,...extra});
 await call('initialize',{policy:{perActionCapUsdc:'60',periodCapUsdc:'100',balanceUsdc:'120',reserveUsdc:'20',expiresAt:'2026-10-20T01:00:00Z'}});await call('resume');
 return {call,get:()=>state};
}
test('ledger binds swap terms at reservation and reconciles actual spend once',async()=>{
 const f=await ledgerFixture({state:'CONFIRMED',spentUnits:'40000000',receivedUnits:'2000000000000000000'});
 await f.call('reserve',{amountUsdc:'50',swapIntent:raw});
 await assert.rejects(f.call('reserve',{amountUsdc:'50',swapIntent:{...raw,minOutputUnits:'1'}}),/bound/);
 await assert.rejects(f.call('track',{transaction:{...tracking,to:pool}}),/pre-recorded/);
 await f.call('track',{transaction:tracking});await assert.rejects(f.call('release'),/manually/);
 const result=await f.call('reconcile');assert.equal(result.reservedUsdc,'0.000000');assert.equal(result.spentUsdc,'40.000000');
 assert.equal((await f.call('reconcile')).spentUsdc,'40.000000');
});
test('invalid settlement amounts cannot mutate reservation accounting',async()=>{
 const f=await ledgerFixture({state:'CONFIRMED',spentUnits:'50000001'});
 await f.call('reserve',{amountUsdc:'50',swapIntent:raw});await f.call('track',{transaction:tracking});
 await assert.rejects(f.call('reconcile'),/Invalid confirmed/);assert.equal(f.get().reservedUnits,'50000000');
});
