import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEarnVaultResponse } from '../packages/agent-modules/arc-app-kits.js';
import { earnLiquiditySource, planIdleUsdcWithEarn } from '../packages/agent-modules/idle-capital-earn.js';
import { idleCapitalExample,idleCapitalInput } from '../packages/agent-modules/idle-capital-view.js';
import { planIdleUsdc } from '../packages/agent-modules/idle-capital.js';
import { buildEarnGuardianSignals } from '../packages/agent-modules/guardian-earn-signals.js';
import { createGuardianEarnState,syncGuardianEarn,guardianEarnHtml } from '../packages/agent-modules/guardian-earn-view.js';
import { createIdleCapitalReceipt,createIdleSourceReviewReceipt,createGuardianEarnReceipt,verifyReceiptDocument,sealDocument } from '../packages/evidence/index.js';
import { translateHolderText } from '../packages/ui/holder-i18n.js';
const now=Date.parse('2026-11-27T12:00:00Z'),at=new Date(now).toISOString(),address=`0x${'1'.repeat(40)}`;
function data(changes={}) {return normalizeEarnVaultResponse({observedAt:at,vaults:[{vaultAddress:address,name:'Test',protocol:'TEST',asset:'USDC',status:'active',liquidity:'50000',currentApy:.05,asOf:at,...changes}]});}
function captured(changes={}) {const d=data(changes);return createIdleCapitalReceipt(planIdleUsdcWithEarn(idleCapitalInput(idleCapitalExample(now),{withdrawalTermsReviewed:true}),earnLiquiditySource(d,address,{now}),d,{now}),{generatedAt:at});}
function review(changes={},slots={a:captured()}) {return createIdleSourceReviewReceipt(slots,data(changes),{now});}
const build=(r,limits)=>buildEarnGuardianSignals(r,limits,{now});
const codes=t=>t.findings.map(f=>f.code);
test('Guardian derives exact threshold signals without changing captured scenarios',()=>{
 const r=review({liquidity:'45000',currentApy:.04}),before=JSON.stringify(r),s=build(r);
 assert.equal(s.targets[0].priority,'REVIEW');assert.deepEqual(codes(s.targets[0]),['LIQUIDITY_DROP_LIMIT','APY_DROP_LIMIT']);assert.equal(JSON.stringify(r),before);
 assert.equal(s.liveWatchRegistered,false);assert.equal(s.delivery.sent,false);assert.deepEqual(s.execution,{prepared:false,signed:false,submitted:false});
});
test('increases and subthreshold declines remain informational; custom limits take effect',()=>{
 for(const c of [{liquidity:'60000',currentApy:.06},{liquidity:'49999.999999',currentApy:.049}]) assert.equal(build(review(c)).targets[0].priority,'INFO');
 assert.equal(build(review({liquidity:'45000',currentApy:.04}),{liquidityDropPct:'11',apyDropPoints:'2'}).targets[0].priority,'INFO');
 assert.equal(build(review(),{liquidityDropPct:'0',apyDropPoints:'0'}).targets[0].priority,'INFO');
});
test('inactive, zero, protocol changes and exceeding captured share are high priority',()=>{
 for(const c of [{status:'paused'},{liquidity:'0'},{protocol:'OTHER'},{liquidity:'30000'}]) assert.equal(build(review(c)).targets[0].priority,'HIGH');
});
test('missing and expired evidence request evidence and never invent a loss',()=>{
 const unavailable=createIdleSourceReviewReceipt({a:captured()},null,{now});
 for(const s of [build(unavailable),buildEarnGuardianSignals(review({status:'paused'}),undefined,{now:now+300001})]) {assert.equal(s.targets[0].priority,'DATA_GAP');assert.deepEqual(codes(s.targets[0]),['FRESH_EVIDENCE_REQUIRED']);}
 assert.ok(codes(build(review({liquidity:null})).targets[0]).includes('LIQUIDITY_UNKNOWN'));
 assert.ok(codes(build(review({currentApy:null})).targets[0]).includes('APY_UNKNOWN'));
});
test('same-vault A/B findings are deduplicated with both scenario references',()=>{
 const a=captured(),s=build(review({liquidity:'45000'},{a,b:a}));assert.equal(s.targets.length,1);assert.equal(s.targets[0].references.length,2);assert.deepEqual(s.targets[0].findings[0].slots,['a','b']);
});
test('manual-only scenarios do not become Earn targets',()=>{
 const a=createIdleCapitalReceipt(planIdleUsdc(idleCapitalInput(idleCapitalExample(now),{withdrawalTermsReviewed:true}),{now}),{generatedAt:at});const s=build(review({},{a}));assert.equal(s.manualScenarios,1);assert.equal(s.targets.length,0);
});
test('decimal APY boundary is stable and limits reject ambiguous input',()=>{
 const s=build(review({currentApy:.002},{a:captured({currentApy:.003})}),{liquidityDropPct:'10',apyDropPoints:'0.1'});assert.ok(codes(s.targets[0]).includes('APY_DROP_LIMIT'));
 for(const value of [10,'-1','101','1e1','1.001','',null]) assert.throws(()=>build(review(),{liquidityDropPct:value,apyDropPoints:'1'}));
});
test('tampered observations fail integrity or semantic recomputation',()=>{
 const r=review();r.reviews[0].current.amountUsdc='100';assert.throws(()=>build(r));
 const {integrity,receiptId,...body}=r;const forged=sealDocument(body,'forged');assert.equal(verifyReceiptDocument(forged).valid,true);assert.throws(()=>build(forged));
 const receipt=createGuardianEarnReceipt(review(),undefined,{now});assert.equal(verifyReceiptDocument(receipt).valid,true);receipt.signals.limits.liquidityDropPct='0';assert.equal(verifyReceiptDocument(receipt).valid,false);
});
test('pending changes clear exports; UI escapes provider names and translates controls',()=>{
 const r=review({name:'<img src=x>'},{a:captured({name:'<img src=x>'})}),state=createGuardianEarnState();syncGuardianEarn(state,r,now);assert.match(guardianEarnHtml(state,r),/&lt;img/);state.pending=true;syncGuardianEarn(state,r,now);assert.equal(state.receipt,null);
 for(const language of ['zh','ja','hi','es']) for(const label of ['Guardian · Earn review attention','VIEW GUARDIAN SIGNALS','DOWNLOAD GUARDIAN EARN SIGNALS','Priority: evidence needed']) assert.notEqual(translateHolderText(label,language),label);
});
