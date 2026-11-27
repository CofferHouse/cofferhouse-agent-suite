import { escapeHtml as h } from '../shared/index.js';
import { defaultEarnGuardianLimits } from './guardian-earn-signals.js';
import { createGuardianEarnReceipt } from '../evidence/guardian-earn-receipt.js';

const priorities={HIGH:'Priority: high',DATA_GAP:'Priority: evidence needed',REVIEW:'Priority: review',INFO:'No threshold signal in this report'};
const labels={FRESH_EVIDENCE_REQUIRED:'Fresh Earn evidence is required; missing data is not a confirmed loss.',VAULT_STATUS_UNKNOWN:'The current vault status is unknown.',VAULT_NOT_ACTIVE:'The provider no longer reports this vault as active.',PROTOCOL_CHANGED:'The reported vault protocol changed.',LIQUIDITY_UNKNOWN:'The current liquidity amount is unknown.',ZERO_LIQUIDITY:'The provider reports zero USDC liquidity.',LIQUIDITY_DROP_LIMIT:'Reported liquidity decline reaches your attention threshold.',CAPTURED_SIZE_EXCEEDS_SHARE:'The saved reviewable amount exceeds its liquidity-share limit at the new reported liquidity.',APY_UNKNOWN:'The APY comparison is unavailable.',APY_DROP_LIMIT:'Reported APY decline reaches your attention threshold.',LIQUIDITY_BASELINE_UNKNOWN:'The saved liquidity baseline cannot support a percentage comparison.',CAPTURED_LIMIT_UNKNOWN:'The captured liquidity-share limit is unknown.'};
export function createGuardianEarnState(){return{values:{...defaultEarnGuardianLimits},pending:false,receipt:null,error:false};}
export function syncGuardianEarn(state,review,now=Date.now()){
  state.receipt=null;state.error=false;
  if(!review||state.pending)return;
  try{state.receipt=createGuardianEarnReceipt(review,state.values,{now});}catch{state.error=true;}
}
export function guardianEarnResultHtml(state){
  if(!state.receipt)return '';
  const signals=state.receipt.signals;
  return '<p>Source review timestamp (UTC)</p><p data-no-translate>'+h(signals.sourceReviewAt)+'</p><p>Signals evaluated at (UTC)</p><p data-no-translate>'+h(signals.evaluatedAt)+'</p>'+
    (signals.targets.length?signals.targets.map(target=>'<article class="guardian-earn-target"><h4>'+priorities[target.priority]+'</h4><p data-no-translate>'+h(target.name)+' · '+h(target.vaultAddress)+'</p><p>Captured scenarios</p><p data-no-translate>'+h(target.references.map(ref=>ref.slot.toUpperCase()).join(', '))+'</p>'+
    (target.findings.length?'<ul>'+target.findings.map(finding=>'<li><span>'+h(labels[finding.code])+'</span> <small data-no-translate>('+h(finding.slots.map(slot=>slot.toUpperCase()).join(', '))+')</small></li>').join('')+'</ul>':'<p>Changes do not cross the entered attention thresholds. This is not a safety approval.</p>')+'</article>').join(''):'<p>The saved scenarios contain no Earn source to prioritize.</p>')+
    '<button class="guardian-earn-download" type="button">DOWNLOAD GUARDIAN EARN SIGNALS</button>';
}
export function guardianEarnHtml(state,review){
  return '<section class="gateway-panel guardian-earn-panel" aria-labelledby="guardian-earn-title"><h3 id="guardian-earn-title">Guardian · Earn review attention</h3><p>Research signals from dated scenario reviews. This does not register a watch or send Telegram messages.</p>'+
    '<button type="button" class="guardian-earn-open-strategy">OPEN SAVED EARN REVIEWS</button>'+
    (!review?'<p>Review saved Earn sources in Strategy Lab before evaluating signals.</p>':'<form class="guardian-earn-limits"><label><span>Liquidity decline threshold (%)</span><input required type="text" name="liquidityDropPct" inputmode="decimal" maxlength="6" pattern="[0-9]{1,3}(\\.[0-9]{1,2})?" value="'+h(state.values.liquidityDropPct)+'"></label><label><span>Reported APY decline threshold (percentage points)</span><input required type="text" name="apyDropPoints" inputmode="decimal" maxlength="6" pattern="[0-9]{1,3}(\\.[0-9]{1,2})?" value="'+h(state.values.apyDropPoints)+'"></label><button type="submit">APPLY ATTENTION LIMITS</button></form>')+
    '<p class="guardian-earn-status" role="status">'+(state.error?'Enter limits from 0 to 100 with up to two decimals, or refresh the source review.':state.pending?'Apply the entered limits before downloading signals.':'')+'</p><div class="guardian-earn-output">'+guardianEarnResultHtml(state)+'</div><p>Higher priority requests human review. It does not authorize a withdrawal, trade or automated exit.</p></section>';
}
export function mountGuardianEarn(root,state,review,{now=Date.now,download=()=>{},openStrategy=()=>{}}={}){
  const panel=root.querySelector('.guardian-earn-panel');if(!panel)return;
  panel.querySelector('.guardian-earn-open-strategy').addEventListener('click',openStrategy);
  const form=panel.querySelector('.guardian-earn-limits'),output=panel.querySelector('.guardian-earn-output'),status=panel.querySelector('.guardian-earn-status');
  if(form){
    const read=()=>{state.values=Object.fromEntries(['liquidityDropPct','apyDropPoints'].map(key=>[key,form.elements.namedItem(key).value.trim()]));};
    form.addEventListener('input',()=>{read();state.pending=true;state.receipt=null;state.error=false;output.replaceChildren();status.textContent='Apply the entered limits before downloading signals.';});
    form.addEventListener('submit',event=>{event.preventDefault();read();state.receipt=null;state.pending=false;syncGuardianEarn(state,review,now());if(state.error)state.pending=true;output.innerHTML=guardianEarnResultHtml(state);status.textContent=state.error?'Enter limits from 0 to 100 with up to two decimals, or refresh the source review.':'';});
  }
  panel.addEventListener('click',event=>{if(event.target.closest('.guardian-earn-download')&&state.receipt)download(state.receipt);});
}
