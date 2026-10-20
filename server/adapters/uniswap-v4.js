import { decodeFunctionData, encodeFunctionData, decodeAbiParameters, encodeAbiParameters, parseAbi, parseAbiParameters, keccak256, toEventSelector } from 'viem';

export const V4_EXECUTE_ABI = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']);
export const V4_SWAP_EVENT_ABI = parseAbi(['event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)']);
export const V4_POOL_KEY_ABI = parseAbiParameters('(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)');
export const V4_ACTIONS_ABI = parseAbiParameters('bytes actions, bytes[] params');
export const V4_PAYMENT_ABI = parseAbiParameters('address currency,uint256 amount');
export const v4SingleAbi = layout => parseAbiParameters(`((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,${layout === 'min-hop-price' ? 'uint256 minHopPriceX36,' : ''}bytes hookData)`);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x)&&!/^0x0{40}$/i.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x)&&!/^0x0{64}$/i.test(x);
const zero='0x0000000000000000000000000000000000000000';
function canonical(abi, data) {
  const decoded=decodeAbiParameters(abi,data);
  if(!same(encodeAbiParameters(abi,decoded),data))throw Error('Noncanonical ABI');
  return decoded;
}
export const v4PoolId=key=>keccak256(encodeAbiParameters(V4_POOL_KEY_ABI,[key]));

// Restricted to a single, hook-free, static-fee pool and exact-input settlement.
// Addresses, code hashes, layout and pool keys are operator-reviewed config.
export function createUniswapV4Adapter({client,router,poolManager,routerCodeHash,poolManagerCodeHash,layout,pools=[]}) {
  if(!address(router)||!address(poolManager)||!hash(routerCodeHash)||!hash(poolManagerCodeHash)||!['legacy','min-hop-price'].includes(layout)||!Array.isArray(pools)||!pools.length)throw Error('Explicit V4 deployment, code hashes, layout and pools are required.');
  const ids=new Set(pools.map(key=>{
    if(!address(key.currency0)||!address(key.currency1)||BigInt(key.currency0)>=BigInt(key.currency1)||!same(key.hooks,zero)||!Number.isInteger(key.fee)||key.fee<0||key.fee>1_000_000||!Number.isInteger(key.tickSpacing)||key.tickSpacing<=0||key.tickSpacing>32767)throw Error('Only sorted, hook-free static-fee V4 pools are supported.');
    return v4PoolId(key);
  }));
  const singleAbi=v4SingleAbi(layout);
  return {async verify({tx,receipt,intent}) {
    try {
      if(!same(tx.to,router)||!same(intent.router,router)||!same(intent.recipient,intent.from))return false;
      const decoded=decodeFunctionData({abi:V4_EXECUTE_ABI,data:tx.input});
      if(!same(encodeFunctionData({abi:V4_EXECUTE_ABI,functionName:'execute',args:decoded.args}),tx.input))return false;
      const [commands,inputs,deadline]=decoded.args;
      // Exact bytes: no allow-revert bit, extra commands, approvals or subplans.
      if(commands!=='0x10'||inputs.length!==1||deadline===0n||deadline>BigInt(Math.floor(Date.parse(intent.expiresAt)/1000)))return false;
      const [actions,params]=canonical(V4_ACTIONS_ABI,inputs[0]);
      if(actions!=='0x060c0f'||params.length!==3)return false;
      const [swap]=canonical(singleAbi,params[0]);
      const [settleToken,settleMax]=canonical(V4_PAYMENT_ABI,params[1]);
      const [takeToken,takeMin]=canonical(V4_PAYMENT_ABI,params[2]);
      const key=swap.poolKey,id=v4PoolId(key);
      if(!ids.has(id)||swap.hookData!=='0x')return false;
      const input=swap.zeroForOne?key.currency0:key.currency1,output=swap.zeroForOne?key.currency1:key.currency0;
      if(!same(input,intent.tokenIn)||!same(output,intent.tokenOut)||!same(settleToken,input)||!same(takeToken,output)||swap.amountIn!==BigInt(intent.maxInputUnits)||swap.amountOutMinimum<BigInt(intent.minOutputUnits)||settleMax!==BigInt(intent.maxInputUnits)||takeMin<BigInt(intent.minOutputUnits))return false;
      const [routerCode,managerCode]=await Promise.all([client.getCode({address:router,blockNumber:receipt.blockNumber}),client.getCode({address:poolManager,blockNumber:receipt.blockNumber})]);
      if(!routerCode||!managerCode||!same(keccak256(routerCode),routerCodeHash)||!same(keccak256(managerCode),poolManagerCodeHash))return false;
      if(receipt.status==='reverted')return true; // No successful events exist.
      if(receipt.status!=='success')return false;
      const {decodeEventLog}=await import('viem');
      const events=receipt.logs.filter(log=>same(log.address,poolManager)&&same(log.topics?.[0],toEventSelector(V4_SWAP_EVENT_ABI[0])));
      if(events.length!==1)return false;
      const event=decodeEventLog({abi:V4_SWAP_EVENT_ABI,data:events[0].data,topics:events[0].topics}).args;
      if(!same(event.id,id)||!same(event.sender,router)||event.fee!==key.fee)return false;
      const inputDelta=swap.zeroForOne?event.amount0:event.amount1,outputDelta=swap.zeroForOne?event.amount1:event.amount0;
      return inputDelta<0n && -inputDelta<=swap.amountIn && outputDelta>=swap.amountOutMinimum;
    }catch{return false;}
  }};
}
