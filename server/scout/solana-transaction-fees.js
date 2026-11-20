import { evaluateLiquidityCashflows } from "../../packages/agent-modules/liquidity-cashflows.js";
import { fetchSolanaTransactionFees, SOLANA_FEE_BATCH_LIMIT } from "../../packages/arc-data/solana-transaction-fees.js";
export function createSolanaFeeHandler({read=fetchSolanaTransactionFees}={}) {
  return async (request,response)=>{
    response.setHeader("Cache-Control","no-store");
    if(request.method!=="POST")return response.status(405).json({ok:false,error:"Method not allowed"});
    let input;
    try {
      if(!request.body || typeof request.body!=="object" || Array.isArray(request.body) || Object.keys(request.body).some(k=>!["historyReceipt","signatures"].includes(k)))throw Error();
      const {historyReceipt,signatures}=request.body;
      const cashflows=evaluateLiquidityCashflows(historyReceipt);
      const events=historyReceipt.history.events,available=[...new Set(events.map(e=>e.signature))];
      const selected=signatures===undefined ? available.slice(0,SOLANA_FEE_BATCH_LIMIT):signatures;
      if(!Array.isArray(selected) || !selected.length || selected.length>SOLANA_FEE_BATCH_LIMIT || new Set(selected).size!==selected.length || selected.some(s=>!available.includes(s)))throw Error();
      const transactions=selected.map(signature=>{
        const rows=events.filter(e=>e.signature===signature);
        if(new Set(rows.map(e=>e.slot)).size!==1 || new Set(rows.map(e=>e.blockTime)).size!==1)throw Error();
        return {signature,slot:rows[0].slot,blockTime:rows[0].blockTime};
      });
      input={target:cashflows.target,transactions,historyReceiptId:historyReceipt.receiptId};
    } catch {return response.status(400).json({ok:false,error:"A valid history receipt and up to three distinct observed signatures are required"});}
    try{return response.status(200).json({ok:true,observation:await read(input)});}
    catch{return response.status(502).json({ok:false,error:"Network fee observation unavailable"});}
  };
}
export default createSolanaFeeHandler();
