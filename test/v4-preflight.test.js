import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { keccak256 } from 'viem';
import { inspectV4Deployment } from '../server/_v4-preflight.js';
const addr=n=>`0x${String(n).repeat(40)}`;
const router=addr(1),manager=addr(2),view=addr(3),usdc=addr(4),output=addr(5),code='0x1234',codeHash=keccak256(code),blockHash=`0x${'6'.repeat(64)}`;
const now=()=>new Date('2026-10-20T15:00:00Z');
function fixture(){
 const calls=[];
 const config={router,poolManager:manager,stateView:view,routerCodeHash:codeHash,poolManagerCodeHash:codeHash,stateViewCodeHash:codeHash,layout:'legacy',outputTokens:[output],tokenCodeHashes:{[usdc]:codeHash,[output]:codeHash},tokenDecimals:{[usdc]:6,[output]:18},pools:[{currency0:usdc,currency1:output,fee:3000,tickSpacing:60,hooks:`0x${'0'.repeat(40)}`}]};
 const block={hash:blockHash,timestamp:BigInt(now().getTime()/1000)};
 const client={getChainId:async()=>5042,getBlockNumber:async()=>42n,getBlock:async args=>{calls.push(['block',args]);return block;},getCode:async args=>{calls.push(['code',args]);return code;},readContract:async args=>{calls.push(['read',args]);if(args.functionName==='poolManager')return manager;if(args.functionName==='decimals')return args.address===usdc?6:18;if(args.functionName==='getSlot0')return [1n,0,0,3000];if(args.functionName==='getLiquidity')return 100n;throw Error('unexpected');}};
 const run=()=>inspectV4Deployment({client,config,chainId:5042,usdc,now});
 return {config,client,block,calls,run};
}
test('preflight pins code and contract reads to a recent canonical snapshot',async()=>{
 const f=fixture(),report=await f.run();assert.equal(report.status,'COMPATIBLE');assert.equal(report.blockNumber,'41');assert.equal(report.executionEnabled,false);
 assert.equal(report.pools[0].activeLiquidity,'100');assert.equal(report.tokens[0].decimals,6);
 assert.ok(f.calls.filter(([kind])=>kind!=='block').every(([,args])=>args.blockNumber===41n));
});
test('wrong chain, missing configuration and stale blocks do not claim compatibility',async()=>{
 let f=fixture();f.client.getChainId=async()=>1;assert.equal((await f.run()).status,'BLOCKED');assert.equal(f.calls.length,0);
 f=fixture();delete f.config.stateViewCodeHash;assert.equal((await f.run()).status,'BLOCKED');assert.equal(f.calls.length,0);
 f=fixture();f.block.timestamp-=121n;assert.equal((await f.run()).status,'BLOCKED');
 f=fixture();f.config.pools[0].hooks=view;assert.equal((await f.run()).status,'BLOCKED');
});
test('bytecode and contract relationships must match reviewed deployment',async()=>{
 let f=fixture();f.client.getCode=async()=> '0xabcd';assert.equal((await f.run()).status,'BLOCKED');assert.ok(!f.calls.some(([kind])=>kind==='read'));
 f=fixture();const read=f.client.readContract;f.client.readContract=async args=>args.functionName==='poolManager'?router:read(args);assert.equal((await f.run()).status,'BLOCKED');
});
test('unexpected token decimals, uninitialized pools, empty liquidity and fee changes block compatibility',async()=>{
 for(const mode of ['decimals','slot0','liquidity','protocol-fee','lp-fee']){
  const f=fixture(),read=f.client.readContract;
  f.client.readContract=async args=>{
   if(mode==='decimals'&&args.functionName==='decimals'&&args.address===usdc)return 18;
   if(mode==='slot0'&&args.functionName==='getSlot0')return [0n,0,0,3000];
   if(mode==='liquidity'&&args.functionName==='getLiquidity')return 0n;
   if(mode==='protocol-fee'&&args.functionName==='getSlot0')return [1n,0,1,3000];
   if(mode==='lp-fee'&&args.functionName==='getSlot0')return [1n,0,0,500];
   return read(args);
  };assert.equal((await f.run()).status,'BLOCKED',mode);
 }
});
test('canonical block changes and provider errors are explicit blockers without leaked details',async()=>{
 let f=fixture(),count=0;f.client.getBlock=async()=>({...f.block,hash:++count===1?blockHash:`0x${'7'.repeat(64)}`});assert.equal((await f.run()).status,'BLOCKED');
 f=fixture();f.client.readContract=async()=>{throw Error('provider credential SECRET');};const report=await f.run();assert.equal(report.status,'BLOCKED');assert.ok(!JSON.stringify(report).includes('SECRET'));
});
test('CLI blocks missing configuration without exposing environment values',()=>{
 const env={...process.env};delete env.BOT_V4_CONFIG;delete env.ARC_RPC_URL;
 const child=spawnSync(process.execPath,['scripts/verify-v4-deployment.mjs'],{encoding:'utf8',env});
 assert.equal(child.status,2);assert.equal(JSON.parse(child.stdout).status,'BLOCKED');assert.equal(JSON.parse(child.stdout).executionEnabled,false);
});
