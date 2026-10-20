import { keccak256, parseAbi } from 'viem';
import { createUniswapV4Adapter, v4PoolId } from './adapters/uniswap-v4.js';
const abi=parseAbi(['function poolManager() view returns (address)','function decimals() view returns (uint8)','function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)','function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)']);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x)&&!/^0x0{40}$/i.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x)&&!/^0x0{64}$/i.test(x);

// Read-only compatibility report. Does not establish economic suitability,
// ownership, permission installation or readiness to broadcast.
export async function inspectV4Deployment({client,config,chainId,usdc,now=()=>new Date()}) {
  const report={schema:'cofferhouse.v4.preflight.v1',status:'BLOCKED',chainId:Number.isSafeInteger(chainId)?chainId:null,blockNumber:null,blockHash:null,checks:[],pools:[],tokens:[],executionEnabled:false};
  const add=(id,pass,detail)=>report.checks.push({id,pass:pass===true,detail});
  try {
    createUniswapV4Adapter({...config,client});
    const tokens=[...new Set([usdc,...(config.outputTokens??[])].map(x=>typeof x==='string'?x.toLowerCase():x))];
    if(!Number.isSafeInteger(chainId)||chainId<=0||!address(usdc)||!address(config.stateView)||!hash(config.stateViewCodeHash)||!Array.isArray(config.outputTokens)||!config.outputTokens.length||config.outputTokens.length>20||config.pools.length>20||!tokens.every(address))throw Error('Incomplete deployment config');
    for(const token of tokens)if(!hash(config.tokenCodeHashes?.[token])||!Number.isInteger(config.tokenDecimals?.[token])||config.tokenDecimals[token]<0||config.tokenDecimals[token]>36)throw Error('Explicit reviewed token hashes and decimals are required');
    if(config.tokenDecimals[usdc.toLowerCase()]!==6)throw Error('USDC accounting requires six decimals');
    add('configuration',true,'Explicit addresses, hashes, layout and pools provided.');
    const observedChain=await client.getChainId();
    add('chain',observedChain===chainId,'RPC chain must match the configured chain.');
    if(observedChain!==chainId)return report;
    const head=await client.getBlockNumber();
    if(head<1n)throw Error('Insufficient chain history');
    const blockNumber=head-1n;
    const block=await client.getBlock({blockNumber});
    report.blockNumber=String(blockNumber);report.blockHash=block.hash;
    const age=now().getTime()-Number(block.timestamp)*1000;
    add('fresh-block',Number.isFinite(age)&&age>=-30_000&&age<=120_000&&hash(block.hash),'Snapshot must be recent and identified.');
    if(!report.checks.at(-1).pass)return report;
    const read=(address,functionName,args=[])=>client.readContract({address,abi,functionName,args,blockNumber});
    for(const [name,contract,expected] of [['router',config.router,config.routerCodeHash],['pool-manager',config.poolManager,config.poolManagerCodeHash],['state-view',config.stateView,config.stateViewCodeHash]]){
      const code=await client.getCode({address:contract,blockNumber});
      const observed=code&&code!=='0x'?keccak256(code):null;
      add(`${name}-code`,same(observed,expected),`${name} runtime code must match its reviewed hash.`);
    }
    // Stop before trusting reads through unexpected runtime bytecode.
    if(report.checks.some(c=>!c.pass))return report;
    for(const [name,contract] of [['router',config.router],['state-view',config.stateView]])add(`${name}-manager`,same(await read(contract,'poolManager'),config.poolManager),`${name} must reference the configured PoolManager.`);
    if(report.checks.some(c=>!c.pass))return report;
    for(const token of tokens){
      const [code,decimals]=await Promise.all([client.getCode({address:token,blockNumber}),read(token,'decimals')]);
      const observed=code&&code!=='0x'?keccak256(code):null;
      const pass=same(observed,config.tokenCodeHashes[token])&&Number(decimals)===config.tokenDecimals[token];
      report.tokens.push({address:token,decimals:Number(decimals),codeHash:observed});
      add(`token-${token}`,pass,'Token runtime and decimals must match reviewed configuration.');
    }
    for(const key of config.pools){
      const id=v4PoolId(key),c0=key.currency0.toLowerCase(),c1=key.currency1.toLowerCase();
      const covered=(same(c0,usdc)&&config.outputTokens.some(x=>same(x,c1)))||(same(c1,usdc)&&config.outputTokens.some(x=>same(x,c0)));
      const [slot0,liquidity]=await Promise.all([read(config.stateView,'getSlot0',[id]),read(config.stateView,'getLiquidity',[id])]);
      const [sqrtPriceX96,tick,protocolFee,lpFee]=slot0;
      report.pools.push({id,sqrtPriceX96:String(sqrtPriceX96),tick:Number(tick),protocolFee:Number(protocolFee),lpFee:Number(lpFee),activeLiquidity:String(liquidity)});
      add(`pool-${id}`,covered&&sqrtPriceX96>0n&&liquidity>0n&&Number(protocolFee)===0&&Number(lpFee)===key.fee,'Pool must be initialized with active liquidity, approved currencies and a supported fee configuration.');
    }
    const canonical=await client.getBlock({blockNumber});
    add('canonical-snapshot',same(canonical.hash,block.hash),'Snapshot block must remain canonical after reads.');
    if(report.checks.every(c=>c.pass))report.status='COMPATIBLE';
    return report;
  }catch{
    add('inspection-complete',false,'Configuration is invalid or RPC observations are unavailable. No compatibility claim produced.');
    return report;
  }
}
