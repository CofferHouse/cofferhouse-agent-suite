import { keccak256, decodeEventLog, parseAbi } from 'viem';
const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const address = x => typeof x === 'string' && /^0x[0-9a-f]{40}$/i.test(x) && !/^0x0{40}$/i.test(x);
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const uint = x => typeof x === 'string' && /^[1-9]\d{0,77}$/.test(x) && BigInt(x) < 2n ** 256n;

export function validateSwapIntent(value, amountUnits, now = new Date()) {
  if (!value || value.kind !== 'SWAP' || ![value.from,value.recipient,value.router,value.tokenIn,value.tokenOut].every(address) || same(value.tokenIn,value.tokenOut) || !Number.isSafeInteger(value.chainId) || value.chainId <= 0 || !uint(value.maxInputUnits) || !uint(value.minOutputUnits) || BigInt(value.maxInputUnits) !== BigInt(amountUnits) || !/^0x[0-9a-f]{64}$/i.test(value.calldataHash ?? '') || !/^[a-zA-Z0-9_-]{3,64}$/.test(value.adapter ?? '')) throw new Error('An identified swap intent, exact budget and nonzero minimum output are required.');
  const expiry = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : NaN;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiry) || expiry <= now.getTime() || expiry > now.getTime() + 300_000) throw new Error('Swap quote authorization must expire within five minutes.');
  return {kind:'SWAP',chainId:value.chainId,adapter:value.adapter,from:value.from.toLowerCase(),recipient:value.recipient.toLowerCase(),router:value.router.toLowerCase(),tokenIn:value.tokenIn.toLowerCase(),tokenOut:value.tokenOut.toLowerCase(),maxInputUnits:value.maxInputUnits,minOutputUnits:value.minOutputUnits,calldataHash:value.calldataHash.toLowerCase(),expiresAt:new Date(expiry).toISOString()};
}

export function validateSwapTracking(transaction, intent) {
  if(!transaction || !/^0x[0-9a-f]{64}$/i.test(transaction.hash ?? '') || transaction.chainId !== intent.chainId || !same(transaction.from,intent.from) || !same(transaction.to,intent.router)) throw new Error('Swap tracking must match the pre-recorded chain, sender and router.');
  return {kind:'SWAP',hash:transaction.hash.toLowerCase(),chainId:intent.chainId,from:intent.from,to:intent.router};
}

// The registry is server-owned. A request can select a registered adapter but
// cannot supply verification code, allowed addresses or a successful outcome.
export function createSwapReconciler({client, chainId, usdc, routers = [], outputTokens = [], adapters = {}, confirmations = 2}) {
  return async operation => {
    const intent=operation.swapIntent, tracked=operation.transaction;
    if(!intent || !tracked || tracked.kind!=='SWAP' || intent.chainId!==chainId || !same(intent.tokenIn,usdc) || !routers.some(x=>same(x,intent.router)) || !outputTokens.some(x=>same(x,intent.tokenOut)) || !Object.hasOwn(adapters,intent.adapter) || typeof adapters[intent.adapter]?.verify!=='function' || !Number.isSafeInteger(confirmations) || confirmations<2) return {state:'REVIEW',reason:'Swap chain, router, output token or protocol adapter is not enabled server-side.'};
    try {
      validateSwapTracking(tracked,intent);
      if(await client.getChainId()!==chainId)return {state:'REVIEW',reason:'RPC chain mismatch.'};
      const [tx,receipt,head]=await Promise.all([client.getTransaction({hash:tracked.hash}),client.getTransactionReceipt({hash:tracked.hash}),client.getBlockNumber()]);
      if(!same(tx.hash,tracked.hash)||!same(receipt.transactionHash,tracked.hash)||!same(tx.from,intent.from)||!same(tx.to,intent.router)||BigInt(tx.value)!==0n||!same(keccak256(tx.input),intent.calldataHash)||!same(tx.blockHash,receipt.blockHash)||tx.blockNumber!==receipt.blockNumber)return {state:'REVIEW',reason:'Swap transaction differs from the recorded authorization.'};
      if(head<receipt.blockNumber||head-receipt.blockNumber+1n<BigInt(confirmations))return {state:'PENDING',reason:'Waiting for swap confirmations.'};
      const block=await client.getBlock({blockNumber:receipt.blockNumber});
      if(!same(block.hash,receipt.blockHash))return {state:'PENDING',reason:'Swap receipt is not canonical.'};
      // Adapter must decode calldata, enforce its deadline/recipients/commands,
      // and verify protocol events for success. Unknown commands must reject.
      if(await adapters[intent.adapter].verify({tx,receipt,intent})!==true)return {state:'REVIEW',reason:'Protocol-specific calldata or events did not match the swap intent.'};
      if(receipt.status==='reverted')return {state:'FAILED',reason:'Matching swap reverted.',blockHash:receipt.blockHash,blockNumber:String(receipt.blockNumber)};
      if(receipt.status!=='success')return {state:'REVIEW',reason:'Unknown swap receipt status.'};
      if(BigInt(block.timestamp)*1000n>BigInt(Date.parse(intent.expiresAt)))return {state:'REVIEW',reason:'Swap was included after the recorded authorization expired.'};
      let input=0n,output=0n;
      for(const log of receipt.logs){
        if(!same(log.address,intent.tokenIn)&&!same(log.address,intent.tokenOut))continue;
        // Ignore unrelated event types, but reject malformed Transfer events.
        if(log.topics?.[0]?.toLowerCase()!=='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')continue;
        let args;try{args=decodeEventLog({abi:transferAbi,data:log.data,topics:log.topics}).args;}catch{return {state:'REVIEW',reason:'Malformed token Transfer event.'};}
        if(same(log.address,intent.tokenIn)){if(same(args.from,intent.from))input+=args.value;if(same(args.to,intent.from))input-=args.value;}
        if(same(log.address,intent.tokenOut)){if(same(args.to,intent.recipient))output+=args.value;if(same(args.from,intent.recipient))output-=args.value;}
      }
      if(input<=0n||input>BigInt(intent.maxInputUnits)||output<BigInt(intent.minOutputUnits))return {state:'REVIEW',reason:'Actual token movements violate input budget or minimum output.'};
      return {state:'CONFIRMED',reason:'Authorized swap and net token movements verified.',spentUnits:String(input),receivedUnits:String(output),blockHash:receipt.blockHash,blockNumber:String(receipt.blockNumber)};
    }catch{return {state:'PENDING',reason:'Swap observation unavailable; funds remain reserved.'};}
  };
}

// Deliberately no production adapter until the actual DEX/router is selected
// and its decoder has protocol-specific fixture coverage.
export async function reconcileConfiguredSwap() {
  return {state:'REVIEW',reason:'No production swap adapter is configured. Reservation remains locked.'};
}
