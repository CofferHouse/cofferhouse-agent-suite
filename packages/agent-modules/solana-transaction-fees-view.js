import { escapeHtml as h } from "../shared/index.js";
export function solanaTransactionFeesHtml(state,receipt) {
  if(!receipt || receipt.history?.status!=="FOUND")return "";
  const signatures=[...new Set(receipt.history.events.map(e=>e.signature))];
  const observation=state.feeMode==="ready" && state.feeObservation?.historyReceiptId===receipt.receiptId ? state.feeObservation:null;
  const labels={OBSERVED:"Network fee observed",NOT_OBSERVED:"Transaction not observed at finalized commitment",MISMATCH:"Transaction identity or position references do not match",FAILED_TRANSACTION:"Failed transaction; indexed activity requires review",UNAVAILABLE:"RPC data is unavailable"};
  return `<section class="solana-fee-panel"><h4>Solana network fee observations</h4>
    <p>Read up to three public transaction signatures from this history through Solana public RPC. No wallet connection or signature is requested.</p>
    <form class="solana-fee-form"><label><span>Transaction group</span><select name="offset" ${state.feeMode==="loading" ? "disabled":""}>${Array.from({length:Math.ceil(signatures.length/3)},(_,i)=>`<option value="${i*3}" ${state.feeOffset===i*3 ? "selected":""}>${i*3+1}–${Math.min(i*3+3,signatures.length)} / ${signatures.length}</option>`).join("")}</select></label><button type="submit" ${state.feeMode==="loading" ? "disabled":""}>CHECK NETWORK FEES</button></form>
    <p role="status">${state.feeMode==="loading" ? "Checking network fees…":state.feeMode==="error" ? "Network fees could not be read. Try again later.":""}</p>
    ${observation ? `<div class="solana-fee-results">${observation.transactions.map(tx=>`<article><code>${h(tx.signature)}</code><p>${h(labels[tx.status] ?? labels.UNAVAILABLE)}</p><dl><div><dt>Whole transaction network fee (SOL)</dt><dd>${h(tx.networkFeeSol ?? "—")}</dd></div><div><dt>Network fee (lamports)</dt><dd>${h(tx.feeLamports ?? "—")}</dd></div><div><dt>RPC-reported fee payer</dt><dd><code>${h(tx.feePayer ?? "—")}</code></dd></div></dl>${tx.feePayerMatchesQueriedUser===false ? '<p>The fee payer differs from the queried wallet. Do not assign this fee automatically.</p>':""}</article>`).join("")}<button class="solana-fee-download" type="button">DOWNLOAD NETWORK FEE RECEIPT</button></div>`:""}
    <p>These are whole-transaction network fees in SOL, not position costs in USD. They do not include all tips, rent or transfer fees. Public RPC can be unavailable or rate-limited. Manual cost entries remain unchanged.</p></section>`;
}
