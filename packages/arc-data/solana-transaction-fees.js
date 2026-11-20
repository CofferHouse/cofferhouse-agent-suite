import { isSolanaPublicKey } from "./jupiter-lend.js";
import { isSolanaSignature } from "./meteora-history.js";
import { validMeteoraPositionTarget } from "./meteora-position.js";
export const SOLANA_FEE_BATCH_LIMIT = 3;
export const SOLANA_FEE_RPC = "https://api.mainnet.solana.com";
export const METEORA_DLMM_PROGRAM = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
const integer = value => Number.isSafeInteger(value) && value >= 0;
const empty = (signature,status) => ({ signature,status,feeLamports:null,networkFeeSol:null,feePayer:null,feePayerMatchesQueriedUser:null,slot:null,blockTime:null,programReferencesObserved:false,allocatedPositionCostUsd:null });
export function normalizeSolanaTransactionFee(payload, expected, target) {
  if (payload?.jsonrpc !== "2.0" || payload.id !== expected.signature || payload.error || !("result" in payload)) return empty(expected.signature,"UNAVAILABLE");
  const result=payload.result;
  if (result===null) return empty(expected.signature,"NOT_OBSERVED");
  const tx=result?.transaction, meta=result?.meta, message=tx?.message;
  if (!meta || !Object.hasOwn(meta,"err") || !integer(result.slot) || !integer(meta.fee) || !["legacy",0].includes(result.version) || !Array.isArray(tx?.signatures) || !tx.signatures.length || tx.signatures.length>64 || !tx.signatures.every(isSolanaSignature)) return empty(expected.signature,"UNAVAILABLE");
  if (tx.signatures[0]!==expected.signature || result.slot!==expected.slot || result.blockTime!==null && (!integer(result.blockTime) || result.blockTime!==expected.blockTime)) return empty(expected.signature,"MISMATCH");
  if (meta.err!==null) return empty(expected.signature,"FAILED_TRANSACTION");
  const keys=message?.accountKeys;
  if (!Array.isArray(keys) || !keys.length || keys.length>256 || keys.some(k=>!isSolanaPublicKey(k?.pubkey) || typeof k.signer!=="boolean" || typeof k.writable!=="boolean") || new Set(keys.map(k=>k.pubkey)).size!==keys.length || keys[0].signer!==true || keys[0].writable!==true || keys[0].source==="lookupTable") return empty(expected.signature,"UNAVAILABLE");
  if (!Array.isArray(message.instructions) || message.instructions.length>256 || meta.innerInstructions!==null && meta.innerInstructions!==undefined && !Array.isArray(meta.innerInstructions)) return empty(expected.signature,"UNAVAILABLE");
  const inner=meta.innerInstructions ?? [];
  if(inner.length>256 || inner.some(group=>!integer(group.index) || group.index>=message.instructions.length || !Array.isArray(group.instructions) || group.instructions.length>256)) return empty(expected.signature,"UNAVAILABLE");
  const instructions=[...message.instructions,...inner.flatMap(group=>group.instructions)];
  if(instructions.length>512) return empty(expected.signature,"UNAVAILABLE");
  const keySet=new Set(keys.map(k=>k.pubkey));
  const referenced=keySet.has(METEORA_DLMM_PROGRAM) && keySet.has(target.pool) && keySet.has(target.position) && instructions.some(ix=>ix?.programId===METEORA_DLMM_PROGRAM && Array.isArray(ix.accounts) && ix.accounts.includes(target.pool) && ix.accounts.includes(target.position));
  if (!referenced) return empty(expected.signature,"MISMATCH");
  const fee=BigInt(meta.fee), remainder=String(fee%1000000000n).padStart(9,"0").replace(/0+$/,"");
  return { ...empty(expected.signature,"OBSERVED"),feeLamports:String(meta.fee),networkFeeSol:`${fee/1000000000n}${remainder ? `.${remainder}`:""}`,feePayer:keys[0].pubkey,feePayerMatchesQueriedUser:keys[0].pubkey===target.user,slot:result.slot,blockTime:result.blockTime,programReferencesObserved:true };
}
async function boundedJson(response) {
  const maxBytes=262144;
  if(Number(response.headers?.get?.("content-length"))>maxBytes) throw Error("Too large");
  if(!response.body?.getReader) return response.json();
  const reader=response.body.getReader(),decoder=new TextDecoder();let text="",bytes=0;
  try { while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes){await reader.cancel();throw Error("Too large");}text+=decoder.decode(part.value,{stream:true});}return JSON.parse(text+decoder.decode()); }
  finally {reader.releaseLock();}
}
export async function fetchSolanaTransactionFees({ target, transactions, historyReceiptId },{fetcher=globalThis.fetch,timeoutMs=10000,now=()=>new Date()}={}) {
  if(!validMeteoraPositionTarget(target) || !Array.isArray(transactions) || !transactions.length || transactions.length>SOLANA_FEE_BATCH_LIMIT || new Set(transactions.map(t=>t.signature)).size!==transactions.length || transactions.some(t=>!isSolanaSignature(t?.signature) || !integer(t.slot) || !integer(t.blockTime)))throw Error("Invalid transaction fee targets");
  const signal=AbortSignal.timeout(timeoutMs);
  const rows=await Promise.all(transactions.map(async expected=>{
    try {
      const response=await fetcher(SOLANA_FEE_RPC,{method:"POST",redirect:"error",signal,headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:expected.signature,method:"getTransaction",params:[expected.signature,{commitment:"finalized",encoding:"jsonParsed",maxSupportedTransactionVersion:0}]})});
      if(!response.ok)throw Error("Unavailable");
      return normalizeSolanaTransactionFee(await boundedJson(response),expected,target);
    } catch {return empty(expected.signature,"UNAVAILABLE");}
  }));
  const observed=rows.filter(r=>r.status==="OBSERVED").length;
  return {
    schema:"cofferhouse.solana.network-fee-observation.v1",status:observed===rows.length ? "OBSERVED":observed ? "PARTIAL":"NO_OBSERVATION",
    mode:"PUBLIC_RPC_RESEARCH",source:"Solana mainnet public JSON-RPC",commitment:"finalized",observedAt:now().toISOString(),target:{...target},historyReceiptId,
    requested:rows.length,observed,transactions:rows,independentlyVerified:false,costAllocationVerified:false,
    execution:{enabled:false,signed:false,submitted:false},
    notice:"RPC-reported whole-transaction network fees, not allocated LP costs. Signatures, slots and DLMM pool/position instruction references are checked, not decoded event amounts or ownership. SOL is not converted to USD. Tips, rent, transfer fees, failed transactions absent from indexed history and historical prices are not reconciled. Public RPC is rate-limited and has no SLA. No input cost is automatically replaced."
  };
}
