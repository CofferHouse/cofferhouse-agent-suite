import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, encodeAbiParameters, encodeEventTopics, keccak256, parseAbi } from 'viem';
import {createUniswapV4Adapter,V4_EXECUTE_ABI,V4_SWAP_EVENT_ABI,V4_ACTIONS_ABI,V4_PAYMENT_ABI,v4SingleAbi,v4PoolId} from '../server/adapters/uniswap-v4.js';
import {createSwapReconciler,reconcileConfiguredSwap} from '../server/_swap-reconciliation.js';
const from=`0x${'1'.repeat(40)}`,router=`0x${'2'.repeat(40)}`,token0=`0x${'3'.repeat(40)}`,token1=`0x${'4'.repeat(40)}`,manager=`0x${'5'.repeat(40)}`,hash=`0x${'6'.repeat(64)}`,blockHash=`0x${'7'.repeat(64)}`;
const key={currency0:token0,currency1:token1,fee:3000,tickSpacing:60,hooks:'0x0000000000000000000000000000000000000000'};
function fixture(layout='legacy',reverse=false){
 const input=reverse?token1:token0,output=reverse?token0:token1;
 const swap={poolKey:key,zeroForOne:!reverse,amountIn:50000000n,amountOutMinimum:1000000000000000000n,hookData:'0x',...(layout==='min-hop-price'?{minHopPriceX36:0n}:{})};
 const params=()=>[encodeAbiParameters(v4SingleAbi(layout),[swap]),encodeAbiParameters(V4_PAYMENT_ABI,[input,50000000n]),encodeAbiParameters(V4_PAYMENT_ABI,[output,1000000000000000000n])];
 const encode=(commands='0x10',actions='0x060c0f',deadline=1792454580n,provided=params())=>encodeFunctionData({abi:V4_EXECUTE_ABI,functionName:'execute',args:[commands,[encodeAbiParameters(V4_ACTIONS_ABI,[actions,provided])],deadline]});
 const tx={hash,from,to:router,input:encode(),value:0n,blockNumber:10n,blockHash};
 const event={id:v4PoolId(key),sender:router,amount0:reverse?2000000000000000000n:-50000000n,amount1:reverse?-50000000n:2000000000000000000n,sqrtPriceX96:1n,liquidity:1n,tick:0,fee:3000};
 const eventLog=()=>({address:manager,topics:encodeEventTopics({abi:V4_SWAP_EVENT_ABI,eventName:'Swap',args:{id:event.id,sender:event.sender}}),data:encodeAbiParameters([{type:'int128'},{type:'int128'},{type:'uint160'},{type:'uint128'},{type:'int24'},{type:'uint24'}],[event.amount0,event.amount1,event.sqrtPriceX96,event.liquidity,event.tick,event.fee])});
 const receipt={transactionHash:hash,status:'success',blockNumber:10n,blockHash,logs:[eventLog()]};
 const intent={router,from,recipient:from,tokenIn:input,tokenOut:output,maxInputUnits:'50000000',minOutputUnits:'1000000000000000000',expiresAt:new Date(1792454580*1000).toISOString()};
 const client={getCode:async()=> '0x1234'};
 const config={client,router,poolManager:manager,routerCodeHash:keccak256('0x1234'),poolManagerCodeHash:keccak256('0x1234'),layout,pools:[key]};
 const adapter=createUniswapV4Adapter(config);
 return {tx,receipt,intent,client,config,adapter,swap,encode,params,event,eventLog,verify:()=>adapter.verify({tx,receipt,intent})};
}
test('V4 adapter decodes each explicitly selected ABI and both currency directions',async()=>{
 for(const layout of ['legacy','min-hop-price'])for(const reverse of [false,true]){
  const f=fixture(layout,reverse);assert.equal(f.tx.input.slice(0,10),'0x3593564c');assert.equal(await f.verify(),true);
 }
});
test('ABI layout mismatch and unknown commands/actions fail closed',async()=>{
 const f=fixture();assert.equal(await createUniswapV4Adapter({...f.config,layout:'min-hop-price'}).verify(f),false);
 for(const input of [f.encode('0x90'),f.encode('0x1010'),f.encode('0x10','0x060c0f0f'),f.encode('0x10','0x070c0f'),`${f.encode()}00`]){f.tx.input=input;assert.equal(await f.verify(),false);}
});
test('calldata enforces tokens, caps, minimum output, payer and deadline',async()=>{
 for(const mutation of [f=>{f.swap.amountIn=50000001n;},f=>{f.swap.amountOutMinimum=1n;},f=>{f.swap.zeroForOne=false;},f=>{f.swap.hookData='0x12';}]){const f=fixture();mutation(f);f.tx.input=f.encode();assert.equal(await f.verify(),false);}
 let f=fixture();f.tx.input=f.encode('0x10','0x060c0f',1792454581n);assert.equal(await f.verify(),false);
 f=fixture();f.intent.recipient=router;assert.equal(await f.verify(),false);
 f=fixture();const p=f.params();p[1]=encodeAbiParameters(V4_PAYMENT_ABI,[token0,50000001n]);f.tx.input=f.encode('0x10','0x060c0f',1792454580n,p);assert.equal(await f.verify(),false);
});
test('only exact configured pools and unchanged deployed bytecode are accepted',async()=>{
 let f=fixture();f.client.getCode=async()=> '0x1235';assert.equal(await f.verify(),false);
 f=fixture();f.swap.poolKey={...key,fee:500};f.tx.input=f.encode();assert.equal(await f.verify(),false);
 assert.throws(()=>createUniswapV4Adapter({...f.config,pools:[{...key,hooks:manager}]}),/hook-free/);
 assert.throws(()=>createUniswapV4Adapter({...f.config,pools:[{...key,fee:0x800000}]}),/static-fee/);
});
test('success needs one PoolManager swap with matching pool, initiator and deltas',async()=>{
 for(const mutation of [f=>{f.receipt.logs=[];},f=>{f.receipt.logs.push(f.eventLog());},f=>{f.receipt.logs[0].address=router;},f=>{f.event.id=hash;f.receipt.logs=[f.eventLog()];},f=>{f.event.sender=from;f.receipt.logs=[f.eventLog()];},f=>{f.event.amount0=1n;f.receipt.logs=[f.eventLog()];},f=>{f.event.amount1=1n;f.receipt.logs=[f.eventLog()];}]){const f=fixture();mutation(f);assert.equal(await f.verify(),false);}
});
test('reverted swaps still require valid calldata and bytecode',async()=>{
 const f=fixture();f.receipt.status='reverted';f.receipt.logs=[];assert.equal(await f.verify(),true);
 f.tx.input=f.encode('0x90');assert.equal(await f.verify(),false);
});
test('production remains disabled without reviewed V4 configuration',async()=>{
 const prev=process.env.BOT_V4_CONFIG;delete process.env.BOT_V4_CONFIG;
 try{assert.equal((await reconcileConfiguredSwap({})).state,'REVIEW');process.env.BOT_V4_CONFIG='{';assert.equal((await reconcileConfiguredSwap({})).state,'REVIEW');}
 finally{if(prev===undefined)delete process.env.BOT_V4_CONFIG;else process.env.BOT_V4_CONFIG=prev;}
});


test('real V4 decoder composes with shared receipt and net-USDC accounting checks',async()=>{
 const f=fixture();
 const transferAbi=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
 const transfer=(address,sender,recipient,amount)=>({address,topics:encodeEventTopics({abi:transferAbi,eventName:'Transfer',args:{from:sender,to:recipient}}),data:encodeAbiParameters([{type:'uint256'}],[amount])});
 f.receipt.logs.push(transfer(token0,from,manager,50000000n),transfer(token1,manager,from,2000000000000000000n));
 Object.assign(f.client,{getChainId:async()=>5042,getTransaction:async()=>f.tx,getTransactionReceipt:async()=>f.receipt,getBlockNumber:async()=>11n,getBlock:async()=>({hash:blockHash,timestamp:1792454570n})});
 const intent={...f.intent,kind:'SWAP',chainId:5042,adapter:'uniswap_v4_single',calldataHash:keccak256(f.tx.input)};
 const operation={amountUnits:'50000000',swapIntent:intent,transaction:{kind:'SWAP',hash,chainId:5042,from,to:router}};
 const reconcile=createSwapReconciler({client:f.client,chainId:5042,usdc:token0,routers:[router],outputTokens:[token1],adapters:{uniswap_v4_single:f.adapter}});
 const result=await reconcile(operation);assert.equal(result.state,'CONFIRMED');assert.equal(result.spentUnits,'50000000');assert.equal(result.receivedUnits,'2000000000000000000');
 f.receipt.logs[2]=transfer(token1,manager,from,1n);assert.equal((await reconcile(operation)).state,'REVIEW');
});
