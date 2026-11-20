import test from "node:test";
import assert from "node:assert/strict";
import { fetchSolanaTransactionFees,normalizeSolanaTransactionFee,METEORA_DLMM_PROGRAM,SOLANA_FEE_RPC } from "../packages/arc-data/solana-transaction-fees.js";
import { normalizeMeteoraHistory } from "../packages/arc-data/meteora-history.js";
import { currentHistoryReceipt } from "../packages/agent-modules/meteora-history-view.js";
import { solanaTransactionFeesHtml } from "../packages/agent-modules/solana-transaction-fees-view.js";
import { createSolanaFeeHandler } from "../server/scout/solana-transaction-fees.js";
import { evaluateLiquidityCashflows } from "../packages/agent-modules/liquidity-cashflows.js";
import { sealDocument,verifyReceiptDocument } from "../packages/evidence/index.js";
import router from "../api/index.js";
const target={pool:"5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",user:"11111111111111111111111111111111",position:"So11111111111111111111111111111111111111112"};
const mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",signature="1".repeat(64),slot=100,blockTime=1795000000;
const otherSignature=(()=>{let n=1n<<511n,text="";const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";while(n){text=alphabet[Number(n%58n)]+text;n/=58n;}return text;})();
const expected={signature,slot,blockTime};
const rpc=()=>({jsonrpc:"2.0",id:signature,result:{version:0,slot,blockTime,transaction:{signatures:[signature],message:{accountKeys:[{pubkey:target.user,signer:true,writable:true,source:"transaction"},...([target.pool,target.position,METEORA_DLMM_PROGRAM].map(pubkey=>({pubkey,signer:false,writable:true,source:"transaction"})))],instructions:[{programId:METEORA_DLMM_PROGRAM,accounts:[target.pool,target.position]}]}},meta:{err:null,fee:5000,innerInstructions:[]}}});
function history(signatures=[signature]){return currentHistoryReceipt(normalizeMeteoraHistory({events:signatures.map((sig,ixIndex)=>({signature:sig,slot,blockTime,ixIndex,eventType:"add",poolAddress:target.pool,positionAddress:target.position,userAddress:target.user,tokenX:target.position,tokenY:mint,amountX:"1",amountY:"1",amountXUsd:"50",amountYUsd:"50",totalUsd:"100",createdAt:"2026-11-20T12:00:00.000Z"}))},target,"2026-11-20T12:00:00.000Z"));}
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test("RPC network fee is exact in lamports/SOL, tied to transaction ID, payer and DLMM references",()=>{
 const row=normalizeSolanaTransactionFee(rpc(),expected,target);
 assert.equal(row.status,"OBSERVED");assert.equal(row.feeLamports,"5000");assert.equal(row.networkFeeSol,"0.000005");
 assert.equal(row.feePayer,target.user);assert.equal(row.feePayerMatchesQueriedUser,true);assert.equal(row.programReferencesObserved,true);assert.equal(row.allocatedPositionCostUsd,null);
 const tiny=rpc();tiny.result.meta.fee=1;assert.equal(normalizeSolanaTransactionFee(tiny,expected,target).networkFeeSol,"0.000000001");
 const zero=rpc();zero.result.meta.fee=0;assert.equal(normalizeSolanaTransactionFee(zero,expected,target).networkFeeSol,"0");
 const payer=rpc();payer.result.transaction.message.accountKeys[0].pubkey=mint;
 assert.equal(normalizeSolanaTransactionFee(payer,expected,target).feePayerMatchesQueriedUser,false);
});
test("parsed inner DLMM instructions work, while mere account-list presence is insufficient",()=>{
 const payload=rpc();payload.result.meta.innerInstructions=[{index:0,instructions:payload.result.transaction.message.instructions}];payload.result.transaction.message.instructions=[{programId:target.user,accounts:[]}];
 assert.equal(normalizeSolanaTransactionFee(payload,expected,target).status,"OBSERVED");
 const listed=rpc();listed.result.transaction.message.instructions=[];assert.equal(normalizeSolanaTransactionFee(listed,expected,target).status,"MISMATCH");
 const split=rpc();split.result.transaction.message.instructions=[{programId:METEORA_DLMM_PROGRAM,accounts:[target.pool]},{programId:METEORA_DLMM_PROGRAM,accounts:[target.position]}];
 assert.equal(normalizeSolanaTransactionFee(split,expected,target).status,"MISMATCH");
});
test("wrong signatures, slots and times do not expose a fee as matched position evidence",()=>{
 for(const change of [p=>p.result.transaction.signatures=[otherSignature],p=>p.result.slot=101,p=>p.result.blockTime=blockTime+1,p=>p.result.transaction.message.instructions[0].accounts=[mint]]){
  const payload=rpc();change(payload);const row=normalizeSolanaTransactionFee(payload,expected,target);assert.equal(row.status,"MISMATCH");assert.equal(row.networkFeeSol,null);
 }
 const nullTime=rpc();nullTime.result.blockTime=null;assert.equal(normalizeSolanaTransactionFee(nullTime,expected,target).status,"OBSERVED");
});
test("RPC errors, unsafe numeric fees, absent metadata and failed transactions never become zero",()=>{
 const missing=normalizeSolanaTransactionFee({jsonrpc:"2.0",id:signature,result:null},expected,target);assert.equal(missing.status,"NOT_OBSERVED");assert.equal(missing.feeLamports,null);
 for(const edit of [p=>p.error={message:"private"},p=>p.result.meta=null,p=>p.result.meta.fee="5000",p=>p.result.meta.fee=Number.MAX_SAFE_INTEGER+1,p=>p.result.meta.fee=-1,p=>delete p.result.meta.err,p=>p.result.version=1,p=>p.id="different",p=>p.result.transaction.message.accountKeys[0].signer=false]){
  const payload=rpc();edit(payload);const row=normalizeSolanaTransactionFee(payload,expected,target);assert.equal(row.status,"UNAVAILABLE");assert.equal(row.feeLamports,null);assert.equal(JSON.stringify(row).includes("private"),false);
 }
 const failed=rpc();failed.result.meta.err={InstructionError:[0,"InvalidArgument"]};assert.equal(normalizeSolanaTransactionFee(failed,expected,target).status,"FAILED_TRANSACTION");
});
test("fee adapter calls only fixed getTransaction reads, one per distinct signature, without URL overrides",async()=>{
 let calls=0;
 const result=await fetchSolanaTransactionFees({target,transactions:[expected],historyReceiptId:"test"},{fetcher:async(url,options)=>{
  calls++;assert.equal(url,SOLANA_FEE_RPC);assert.equal(options.method,"POST");assert.equal(options.redirect,"error");
  const body=JSON.parse(options.body);assert.equal(body.method,"getTransaction");assert.equal(body.params[0],signature);assert.deepEqual(body.params[1],{commitment:"finalized",encoding:"jsonParsed",maxSupportedTransactionVersion:0});
  return {ok:true,json:async()=>rpc()};
 }});
 assert.equal(calls,1);assert.equal(result.status,"OBSERVED");assert.equal(result.costAllocationVerified,false);assert.equal(result.independentlyVerified,false);assert.equal(result.execution.submitted,false);
 assert.equal(verifyReceiptDocument(sealDocument({schema:"cofferhouse.solana.network-fee-receipt.v1",observation:result},"solana-network-fees")).valid,true);
 await assert.rejects(()=>fetchSolanaTransactionFees({target,transactions:[expected,expected],historyReceiptId:"x"}),/Invalid/);
 await assert.rejects(()=>fetchSolanaTransactionFees({target,transactions:Array(4).fill(expected),historyReceiptId:"x"}),/Invalid/);
});
test("rate limits and oversized responses stay unavailable and mixed batches preserve partial status",async()=>{
 const unavailable=await fetchSolanaTransactionFees({target,transactions:[expected],historyReceiptId:"x"},{fetcher:async()=>({ok:false,status:429})});assert.equal(unavailable.status,"NO_OBSERVATION");assert.equal(unavailable.transactions[0].networkFeeSol,null);
 const large=await fetchSolanaTransactionFees({target,transactions:[expected],historyReceiptId:"x"},{fetcher:async()=>({ok:true,headers:{get:()=>"262145"}})});assert.equal(large.transactions[0].status,"UNAVAILABLE");
 const streamed=await fetchSolanaTransactionFees({target,transactions:[expected],historyReceiptId:"x"},{fetcher:async()=>new Response(JSON.stringify(rpc()))});assert.equal(streamed.status,"OBSERVED");
 const oversizedStream=await fetchSolanaTransactionFees({target,transactions:[expected],historyReceiptId:"x"},{fetcher:async()=>new Response(JSON.stringify({...rpc(),padding:"x".repeat(262144)}))});assert.equal(oversizedStream.transactions[0].status,"UNAVAILABLE");
 const second={signature:otherSignature,slot,blockTime};
 const partial=await fetchSolanaTransactionFees({target,transactions:[expected,second],historyReceiptId:"x"},{fetcher:async(url,options)=>({ok:true,json:async()=>JSON.parse(options.body).id===signature ? rpc():{jsonrpc:"2.0",id:second.signature,result:null}})});
 assert.equal(partial.status,"PARTIAL");assert.equal(partial.observed,1);
});
test("fee endpoint accepts only signatures from a valid receipt and rejects input before RPC",async()=>{
 let calls=0;const receipt=history();const api=createSolanaFeeHandler({read:async input=>{calls++;assert.deepEqual(input.transactions,[expected]);assert.equal(input.historyReceiptId,receipt.receiptId);return {status:"NO_OBSERVATION"};}});
 assert.equal((await api({method:"GET"},response())).code,405);
 for(const body of [{}, {historyReceipt:receipt,signatures:[]},{historyReceipt:receipt,signatures:[signature,signature]},{historyReceipt:receipt,signatures:[otherSignature]},{historyReceipt:receipt,rpcUrl:"https://evil"}])assert.equal((await api({method:"POST",body},response())).code,400);
 assert.equal(calls,0);
 const altered=structuredClone(receipt);altered.history.events[0].slot=200;assert.equal((await api({method:"POST",body:{historyReceipt:altered}},response())).code,400);
 const good=await api({method:"POST",body:{historyReceipt:receipt}},response());assert.equal(good.code,200);assert.equal(good.headers["Cache-Control"],"no-store");assert.equal(calls,1);
 assert.equal((await router({method:"GET",url:"/api?endpoint=scout/solana-transaction-fees"},response())).code,405);
});
test("fee observations leave manual cost entries unknown and the view hides old receipt evidence",async()=>{
 const receipt=history();const observation=await fetchSolanaTransactionFees({target,transactions:[expected],historyReceiptId:receipt.receiptId},{fetcher:async()=>({ok:true,json:async()=>rpc()})});
 const cashflows=evaluateLiquidityCashflows(receipt);assert.equal(cashflows.costCoverage,"MISSING_TRANSACTION_COSTS");assert.equal(cashflows.indexedBalanceAfterEnteredCostsUsd,null);
 const html=solanaTransactionFeesHtml({feeMode:"ready",feeObservation:observation},receipt);assert.match(html,/0.000005/);assert.match(html,/Manual cost entries remain unchanged/);
 assert.equal(solanaTransactionFeesHtml({feeMode:"ready",feeObservation:{...observation,historyReceiptId:"old"}},receipt).includes('class="solana-fee-download"'),false);
 assert.equal(solanaTransactionFeesHtml({feeMode:"error",feeObservation:observation},receipt).includes('class="solana-fee-download"'),false);
 assert.equal(solanaTransactionFeesHtml({},null),"");
});
