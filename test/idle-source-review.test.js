import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEarnVaultResponse } from '../packages/agent-modules/arc-app-kits.js';
import { earnLiquiditySource, planIdleUsdcWithEarn } from '../packages/agent-modules/idle-capital-earn.js';
import { idleCapitalExample, idleCapitalInput } from '../packages/agent-modules/idle-capital-view.js';
import { planIdleUsdc } from '../packages/agent-modules/idle-capital.js';
import { createIdleCapitalReceipt, createIdleSourceReviewReceipt, verifyReceiptDocument } from '../packages/evidence/index.js';
import { reviewIdleCapitalSource } from '../packages/agent-modules/idle-source-review.js';
import { idleSourceReviewHtml } from '../packages/agent-modules/idle-source-review-view.js';
import { translateHolderText } from '../packages/ui/holder-i18n.js';
const now=Date.parse('2026-11-25T12:00:00.000Z'), at=new Date(now).toISOString(), address=`0x${'1'.repeat(40)}`;
function data(changes={},meta={}) {return normalizeEarnVaultResponse({observedAt:at,vaults:[{vaultAddress:address,name:'Test',protocol:'TEST',asset:'USDC',status:'active',liquidity:'50000',currentApy:0.05,asOf:at,...changes}],...meta});}
function captured() {const d=data(),s=earnLiquiditySource(d,address,{now});return createIdleCapitalReceipt(planIdleUsdcWithEarn(idleCapitalInput(idleCapitalExample(now),{withdrawalTermsReviewed:true}),s,d,{now}),{generatedAt:at,example:true});}
const review=(d,opts={})=>reviewIdleCapitalSource(captured(),d,{now,...opts});
test('unchanged reports are informational and do not verify underlying freshness or withdrawals',()=>{
 const r=review(data());assert.equal(r.status,'UNCHANGED');assert.equal(r.deltaLiquidityUsdc,'0.000000');assert.equal(r.underlyingFreshnessVerified,false);assert.equal(r.withdrawalGuaranteed,false);
});
test('changed liquidity, APY, inactive status and captured liquidity share are reported without changing the scenario',()=>{
 const receipt=captured(), before=JSON.stringify(receipt);
 const r=reviewIdleCapitalSource(receipt,data({liquidity:'30000',currentApy:0.02,status:'paused'}),{now});
 assert.equal(r.status,'CHANGED');assert.equal(r.deltaLiquidityUsdc,'-20000.000000');
 for(const issue of ['LIQUIDITY_CHANGED','APY_CHANGED','VAULT_NOT_ACTIVE','CAPTURED_SIZE_EXCEEDS_SHARE']) assert.ok(r.issues.includes(issue));
 assert.equal(JSON.stringify(receipt),before);assert.equal(receipt.scenario.assumptions.scenarioAnnualSimpleRateBps,500);
});
test('reported zero is a real zero but missing liquidity remains unknown',()=>{
 const zero=review(data({liquidity:'0'}));assert.equal(zero.current.amountUsdc,'0');assert.equal(zero.deltaLiquidityUsdc,'-50000.000000');assert.ok(zero.issues.includes('ZERO_LIQUIDITY'));
 const unknown=review(data({liquidity:null}));assert.equal(unknown.status,'INCOMPLETE');assert.equal(unknown.current.amountUsdc,null);assert.equal(unknown.deltaLiquidityUsdc,null);
});
test('stale, future and older-than-capture responses do not produce current comparisons',()=>{
 for(const timestamp of ['bad',new Date(now+1).toISOString(),new Date(now-300001).toISOString()]) {const r=review(data({}, {observedAt:timestamp}));assert.equal(r.status,'UNAVAILABLE');assert.ok(r.issues.includes('SOURCE_STALE'));assert.equal(r.current,null);}
 assert.ok(review(data({}, {observedAt:new Date(now-1).toISOString()})).issues.includes('OLDER_RESPONSE'));
 assert.ok(review(data({asOf:new Date(now-1).toISOString()})).issues.includes('OLDER_RESPONSE'));
 assert.ok(review(data({asOf:new Date(now-300001).toISOString()})).issues.includes('SOURCE_STALE'));
});
test('omission from a page is not closure and ambiguous or mismatched identities are rejected',()=>{
 assert.ok(review(data({}, {vaults:[]})).issues.includes('VAULT_NOT_RETURNED'));
 const duplicate=data();duplicate.vaults.push(duplicate.vaults[0]);assert.ok(review(duplicate).issues.includes('DUPLICATE_IDENTITY'));
 assert.ok(review(data({asset:'EURC'})).issues.includes('ASSET_CHANGED'));
 assert.ok(review(null).issues.includes('SOURCE_UNAVAILABLE'));
});
test('manual scenarios have no Earn source and missing APY never becomes zero',()=>{
 const manual=createIdleCapitalReceipt(planIdleUsdc(idleCapitalInput(idleCapitalExample(now),{withdrawalTermsReviewed:true}),{now}),{generatedAt:at});
 assert.equal(reviewIdleCapitalSource(manual,null,{now}).status,'NO_EARN_SOURCE');
 const r=review(data({currentApy:null}));assert.equal(r.status,'INCOMPLETE');assert.equal(r.current.reportedApyPct,null);assert.ok(r.issues.includes('APY_UNKNOWN'));
});
test('review receipts retain original sealed snapshots and detect changes to review observations',()=>{
 const a=captured(),r=createIdleSourceReviewReceipt({a},data({liquidity:'49999.999999'}),{now:now+1000});
 assert.equal(verifyReceiptDocument(r).valid,true);assert.equal(r.snapshots.a.generatedAt,at);assert.equal(r.reviews[0].deltaLiquidityUsdc,'-0.000001');
 const altered=structuredClone(r);altered.reviews[0].current.amountUsdc='999';assert.equal(verifyReceiptDocument(altered).valid,false);
 assert.deepEqual(r.execution,{prepared:false,signed:false,submitted:false});
 assert.throws(()=>createIdleSourceReviewReceipt({},null,{now}));
 const bad=structuredClone(a);bad.scenario.protectedUsdc='0';assert.throws(()=>reviewIdleCapitalSource(bad,null,{now}));
});
test('source review controls translate and unavailable evidence is not displayed as zero',()=>{
 for(const language of ['zh','ja','hi','es']) for(const label of ['Review saved sources against Earn','CHECK SAVED EARN SOURCES','DOWNLOAD EARN SOURCE REVIEW','Current Earn evidence is unavailable.']) assert.notEqual(translateHolderText(label,language),label);
 const r=createIdleSourceReviewReceipt({a:captured()},null,{now});
 const html=idleSourceReviewHtml({a:captured(),sourceReview:r,reviewMode:'ready'});
 assert.match(html,/Current Earn evidence is unavailable/);assert.match(html,/—/);assert.ok(!html.includes('>0.000000<'));
});
