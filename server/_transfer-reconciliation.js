import { createPublicClient, http, encodeFunctionData, parseAbi, decodeEventLog } from 'viem';
const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)', 'event Transfer(address indexed from, address indexed to, uint256 value)']);
const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

export function validateTransferTracking(value) {
  if (!value || !/^0x[0-9a-f]{64}$/i.test(value.hash ?? '') || ![value.from,value.to,value.token].every(address) || same(value.from,value.to) || !Number.isSafeInteger(value.chainId) || value.chainId <= 0) throw new Error('A transaction hash and explicit chain, sender, recipient and USDC token are required.');
  return {hash:value.hash.toLowerCase(),from:value.from.toLowerCase(),to:value.to.toLowerCase(),token:value.token.toLowerCase(),chainId:value.chainId};
}

// Only direct USDC ERC-20 transfers. Swap/router receipts need separate decoders.
export function createTransferReconciler({ client, chainId, token, confirmations = 2 }) {
  return async operation => {
    const tracked = validateTransferTracking(operation.transaction);
    if (!Number.isSafeInteger(confirmations) || confirmations < 2 || tracked.chainId !== chainId || !same(tracked.token,token)) return {state:'REVIEW',reason:'Configured chain/token or finality policy mismatch.'};
    try {
      if (await client.getChainId() !== chainId) return {state:'REVIEW',reason:'RPC chain mismatch.'};
      const [tx, receipt, head] = await Promise.all([client.getTransaction({hash:tracked.hash}),client.getTransactionReceipt({hash:tracked.hash}),client.getBlockNumber()]);
      const expectedInput=encodeFunctionData({abi,functionName:'transfer',args:[tracked.to,BigInt(operation.amountUnits)]});
      if (!same(tx.hash,tracked.hash) || !same(receipt.transactionHash,tracked.hash) || !same(tx.from,tracked.from) || !same(tx.to,tracked.token) || !same(tx.input,expectedInput) || BigInt(tx.value) !== 0n || tx.blockNumber !== receipt.blockNumber || !same(tx.blockHash,receipt.blockHash)) return {state:'REVIEW',reason:'Transaction identity or transfer calldata mismatch.'};
      if (head < receipt.blockNumber || head - receipt.blockNumber + 1n < BigInt(confirmations)) return {state:'PENDING',reason:'Waiting for confirmations.'};
      const block=await client.getBlock({blockNumber:receipt.blockNumber});
      if (!same(block.hash,receipt.blockHash)) return {state:'PENDING',reason:'Receipt is not in the current canonical block.'};
      if (receipt.status === 'reverted') return {state:'FAILED',reason:'Matching transaction reverted.',blockHash:receipt.blockHash,blockNumber:String(receipt.blockNumber)};
      if(receipt.status !== 'success') return {state:'REVIEW',reason:'Unknown receipt status.'};
      let total=0n;
      for(const log of receipt.logs){
        if(!same(log.address,tracked.token))continue;
        try { const decoded=decodeEventLog({abi,data:log.data,topics:log.topics});
          if(decoded.eventName==='Transfer' && same(decoded.args.from,tracked.from)) {
            if(!same(decoded.args.to,tracked.to))return {state:'REVIEW',reason:'Unexpected outgoing USDC recipient.'};
            total+=decoded.args.value;
          }
        }catch {return {state:'REVIEW',reason:'Unrecognized USDC receipt event.'};}
      }
      if(total!==BigInt(operation.amountUnits))return {state:'REVIEW',reason:'Confirmed transfer amount does not match the reservation.'};
      return {state:'CONFIRMED',reason:'Direct USDC transfer confirmed.',blockHash:receipt.blockHash,blockNumber:String(receipt.blockNumber)};
    } catch { return {state:'PENDING',reason:'RPC observation unavailable or transaction not yet indexed; funds remain reserved.'}; }
  };
}
export async function reconcileConfiguredTransfer(operation) {
  const chainId=Number(process.env.BOT_CHAIN_ID);
  const token=process.env.BOT_USDC_ADDRESS;
  const rpc=process.env.ARC_RPC_URL;
  if(!Number.isSafeInteger(chainId)||chainId<=0||!address(token)||!rpc?.startsWith('https://')) return {state:'PENDING',reason:'Transfer reconciliation is not configured; funds remain reserved.'};
  return createTransferReconciler({client:createPublicClient({transport:http(rpc,{timeout:10_000,retryCount:0})}),chainId,token})(operation);
}
