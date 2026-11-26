import test from 'node:test';
import assert from 'node:assert/strict';
import {readIdleCapitalScenario,readIdleCapitalScenarioFile,MAX_IDLE_SCENARIO_BYTES} from '../packages/agent-modules/idle-scenario-import.js';
import {idleCapitalExample,idleCapitalInput} from '../packages/agent-modules/idle-capital-view.js';
import {planIdleUsdc} from '../packages/agent-modules/idle-capital.js';
import {normalizeEarnVaultResponse} from '../packages/agent-modules/arc-app-kits.js';
import {earnLiquiditySource,planIdleUsdcWithEarn} from '../packages/agent-modules/idle-capital-earn.js';
import {createIdleCapitalReceipt,createIdleCapitalComparisonReceipt,sealDocument,verifyReceiptDocument} from '../packages/evidence/index.js';
import {idleCapitalComparisonHtml} from '../packages/agent-modules/idle-capital-comparison-view.js';
import {translateHolderText} from '../packages/ui/holder-i18n.js';
const at=Date.parse('2026-11-25T12:00:00.000Z'),now=at+86400000;
function receipt(){return createIdleCapitalReceipt(planIdleUsdc(idleCapitalInput(idleCapitalExample(at),{withdrawalTermsReviewed:true}),{now:at}),{generatedAt:new Date(at).toISOString(),example:true});}
const reseal=doc=>{const {integrity,receiptId,...body}=doc;return sealDocument(body,'idle-capital');};
test('historical scenarios are restored without changing dates, math or provenance',()=>{
 const original=receipt(),restored=readIdleCapitalScenario(JSON.stringify(original),{now});
 assert.deepEqual(restored,original);assert.notEqual(restored,original);assert.equal(verifyReceiptDocument(restored).valid,true);
 original.scenario.assumptions.walletUsdc='999';assert.equal(restored.scenario.assumptions.walletUsdc,'10000');
});
test('bounded file decoding accepts UTF-8 JSON and BOM but rejects oversized and malformed bytes before use',async()=>{
 const text=JSON.stringify(receipt()),bytes=new TextEncoder().encode(text);
 assert.deepEqual(await readIdleCapitalScenarioFile({size:bytes.length,arrayBuffer:async()=>bytes.buffer},{now}),receipt());
 assert.deepEqual(readIdleCapitalScenario('\uFEFF'+text,{now}),receipt());
 let read=false;await assert.rejects(()=>readIdleCapitalScenarioFile({size:64001,arrayBuffer:async()=>{read=true;return bytes.buffer;}},{now}));assert.equal(read,false);
 await assert.rejects(()=>readIdleCapitalScenarioFile({size:2,arrayBuffer:async()=>new Uint8Array([255,255]).buffer},{now}));
 assert.throws(()=>readIdleCapitalScenario(' '.repeat(MAX_IDLE_SCENARIO_BYTES+1),{now}));
});
test('malformed, nested, prototype-bearing, nonfinite and unsupported archives are rejected',()=>{
 const comparison=createIdleCapitalComparisonReceipt(receipt(),receipt());
 for(const input of ['bad','[]','null','{"__proto__":{}}','{"n":1e999}',JSON.stringify(comparison),JSON.stringify({schema:'unrelated'}),JSON.stringify({deep:[...Array(65)].map(()=>0)})]) assert.throws(()=>readIdleCapitalScenario(input,{now}));
 let deep={};for(let i=0;i<14;i++)deep={child:deep};assert.throws(()=>readIdleCapitalScenario(JSON.stringify(deep),{now}));
});
test('tampering and resealed false arithmetic or executable claims are rejected',()=>{
 const bad=receipt();bad.scenario.netScenarioAfterEnteredCostsUsdc='999';assert.throws(()=>readIdleCapitalScenario(JSON.stringify(bad),{now}));assert.throws(()=>readIdleCapitalScenario(JSON.stringify(reseal(bad)),{now}));
 for(const mutate of [r=>r.scenario.execution.submitted=true,r=>r.scenario.observationVerified=true,r=>r.scenario.withdrawalGuaranteed=true,r=>r.scenario.mode='unknown',r=>r.generatedAt='2026-11-27T12:00:00.000Z']){const r=receipt();mutate(r);assert.throws(()=>readIdleCapitalScenario(JSON.stringify(reseal(r)),{now}));}
});
test('captured Earn source metadata remains historical, strict and escaped in the view',()=>{
 const address=`0x${'1'.repeat(40)}`,time=new Date(at).toISOString();
 const data=normalizeEarnVaultResponse({observedAt:time,vaults:[{vaultAddress:address,name:'<img src=x>',protocol:'TEST',asset:'USDC',status:'active',liquidity:'50000',currentApy:0.05}]});
 const source=earnLiquiditySource(data,address,{now:at}),plan=planIdleUsdcWithEarn(idleCapitalInput(idleCapitalExample(at),{withdrawalTermsReviewed:true}),source,data,{now:at});
 const original=createIdleCapitalReceipt(plan,{generatedAt:time,example:true}),restored=readIdleCapitalScenario(JSON.stringify(original),{now});
 assert.equal(restored.scenario.marketSource.retrievedAt,time);assert.equal(restored.inputSource,'EARN_LIQUIDITY_WITH_EDITABLE_SYNTHETIC_CASH');
 const html=idleCapitalComparisonHtml({a:restored,b:null,receipt:null,error:false});assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
 for(const mutate of [r=>r.scenario.marketSource.asset='EURC',r=>r.scenario.marketSource.amountUsdc=50000,r=>r.scenario.marketSource.providerFreshnessVerified=true,r=>r.scenario.sourceReview.status='approved']){const r=structuredClone(original);mutate(r);assert.throws(()=>readIdleCapitalScenario(JSON.stringify(reseal(r)),{now}));}
});
test('opening historical scenarios has translated controls and describes local-only checking',()=>{
 for(const language of ['zh','ja','hi','es']) for(const label of ['OPEN SCENARIO A','OPEN SCENARIO B','Historical scenario loaded. Its original dates remain unchanged.','Scenario file rejected. The saved slot is unchanged.'])assert.notEqual(translateHolderText(label,language),label);
});
