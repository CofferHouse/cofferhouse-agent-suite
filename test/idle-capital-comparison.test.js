import test from 'node:test';
import assert from 'node:assert/strict';
import { planIdleUsdc } from '../packages/agent-modules/idle-capital.js';
import { captureIdleCapitalScenario, compareIdleCapitalReceipts } from '../packages/agent-modules/idle-capital-comparison.js';
import { createIdleCapitalReceipt, createIdleCapitalComparisonReceipt, verifyReceiptDocument, sealDocument } from '../packages/evidence/index.js';
import { idleCapitalExample, idleCapitalInput, createIdleCapitalState } from '../packages/agent-modules/idle-capital-view.js';
import { idleCapitalComparisonHtml } from '../packages/agent-modules/idle-capital-comparison-view.js';
const now = Date.parse('2026-11-24T12:00:00.000Z'), at = new Date(now).toISOString();
function receipt(changes = {}) {
 const input = { ...idleCapitalInput(idleCapitalExample(now), { withdrawalTermsReviewed: true }), ...changes };
 return createIdleCapitalReceipt(planIdleUsdc(input, { now }), { generatedAt: at, example: true });
}
const row = (comparison, key) => comparison.rows.find(row => row.id === key);
test('comparison computes exact B minus A amounts, including negative net scenarios', () => {
 const a = receipt(), b = receipt({ entryCostUsdc: '10' });
 const c = compareIdleCapitalReceipts(a, b);
 assert.equal(c.status, 'ARITHMETIC_COMPARISON_ONLY');
 assert.equal(row(c,'costs').deltaBMinusAUsdc,'9.500000');
 assert.equal(row(c,'net').deltaBMinusAUsdc,'-9.500000');
 assert.equal(row(c,'reviewable').deltaBMinusAUsdc,'-4000.000000');
 assert.equal(c.decisionsAtCapture.b,'KEEP_LIQUID');
 assert.deepEqual(c.execution,{prepared:false,signed:false,submitted:false});
});
test('different initial cash or horizon hides all differences instead of ranking unequal scenarios', () => {
 for (const [changes, issue] of [[{walletUsdc:'10001'},'DIFFERENT_WALLET_BALANCE'],[{holdingHours:241},'DIFFERENT_HOLDING_WINDOW']]) {
  const c = compareIdleCapitalReceipts(receipt(), receipt(changes));
  assert.equal(c.status,'NOT_COMPARABLE'); assert.ok(c.issues.includes(issue));
  assert.ok(c.rows.every(row=>row.deltaBMinusAUsdc===null));
 }
});
test('the same receipt in both slots is flagged, while incomplete amounts never turn into zero', () => {
 const a=receipt(); assert.ok(compareIdleCapitalReceipts(a,a).issues.includes('SAME_SNAPSHOT'));
 const c=compareIdleCapitalReceipts(a,receipt({exitCostUsdc:undefined}));
 assert.ok(c.issues.includes('INCOMPLETE_SCENARIO')); assert.equal(row(c,'net').bUsdc,null);
 assert.ok(c.rows.every(row=>row.deltaBMinusAUsdc===null));
});
test('captures are detached copies and comparison includes both original sealed snapshots', () => {
 const a=receipt(), b=receipt({entryCostUsdc:'1'}), copy=captureIdleCapitalScenario(a);
 a.scenario.assumptions.walletUsdc='999'; assert.equal(copy.scenario.assumptions.walletUsdc,'10000');
 const r=createIdleCapitalComparisonReceipt(copy,b,{generatedAt:'2026-11-25T12:00:00.000Z'});
 assert.equal(verifyReceiptDocument(r).valid,true); assert.equal(verifyReceiptDocument(r.snapshots.a).valid,true);
 assert.equal(r.snapshots.a.generatedAt,at); assert.equal(r.generatedAt,'2026-11-25T12:00:00.000Z');
 const altered=structuredClone(r); altered.snapshots.a.scenario.assumptions.reserveUsdc='0';
 assert.equal(verifyReceiptDocument(altered).valid,false);
});
test('tampered or resealed inconsistent arithmetic and executable artifacts are rejected', () => {
 const a=receipt(), b=receipt({entryCostUsdc:'1'});
 const changed=structuredClone(a); changed.scenario.netScenarioAfterEnteredCostsUsdc='1000';
 assert.throws(()=>compareIdleCapitalReceipts(changed,b));
 const {integrity,receiptId,...payload}=changed;
 assert.throws(()=>compareIdleCapitalReceipts(sealDocument(payload,'idle-capital'),b),/arithmetic/);
 const executable=structuredClone(payload); executable.scenario.execution.submitted=true;
 assert.throws(()=>captureIdleCapitalScenario(sealDocument(executable,'idle-capital')));
 const falseReview=receipt({withdrawalTermsReviewed:false});
 const {integrity:unused,receiptId:unusedId,...falsePayload}=falseReview;
 falsePayload.scenario.decision='REVIEW_REQUIRED'; falsePayload.scenario.reasons=[]; falsePayload.scenario.reviewableAllocationUsdc='4000.000000';
 assert.throws(()=>captureIdleCapitalScenario(sealDocument(falsePayload,'idle-capital')));
});
test('micro-unit differences remain exact for large balances', () => {
 const a=receipt({walletUsdc:'9007199254740993.123456',maxAllocationUsdc:'1000',entryCostUsdc:'0.000001'});
 const b=receipt({walletUsdc:'9007199254740993.123456',maxAllocationUsdc:'1000',entryCostUsdc:'0.000002'});
 const c=compareIdleCapitalReceipts(a,b);
 assert.equal(row(c,'wallet').aUsdc,'9007199254740993.123456'); assert.equal(row(c,'costs').deltaBMinusAUsdc,'0.000001');
 assert.equal(row(c,'net').deltaBMinusAUsdc,'-0.000001');
});
test('saved view explains historical scope, shows blocked decisions and does not choose a winner', () => {
 const state=createIdleCapitalState(); assert.deepEqual(state.saved,{a:null,b:null,receipt:null,error:false});
 const a=receipt(),b=receipt({entryCostUsdc:'10'}),comparison=createIdleCapitalComparisonReceipt(a,b,{generatedAt:at});
 const html=idleCapitalComparisonHtml({a,b,receipt:comparison,error:false});
 assert.match(html,/Keep funds liquid/); assert.match(html,/do not refresh Earn/); assert.match(html,/-9.500000/);
 assert.ok(!html.includes('winner')); assert.match(html,/DOWNLOAD SCENARIO COMPARISON/);
 const incomplete=idleCapitalComparisonHtml({a,b:null,receipt:null,error:false}); assert.ok(!incomplete.includes('idle-comparison-download'));
});
test('comparison retains captured Earn source metadata without refreshing its observation time', async () => {
 const { normalizeEarnVaultResponse } = await import('../packages/agent-modules/arc-app-kits.js');
 const { earnLiquiditySource, planIdleUsdcWithEarn } = await import('../packages/agent-modules/idle-capital-earn.js');
 const address=`0x${'1'.repeat(40)}`;
 const data=normalizeEarnVaultResponse({observedAt:at,vaults:[{vaultAddress:address,name:'<img src=x>',protocol:'TEST',asset:'USDC',status:'active',liquidity:'50000',currentApy:0.05,asOf:at}]});
 const source=earnLiquiditySource(data,address,{now});
 const input=idleCapitalInput(idleCapitalExample(now),{withdrawalTermsReviewed:true});
 const a=createIdleCapitalReceipt(planIdleUsdcWithEarn(input,source,data,{now}),{generatedAt:at,example:true}), b=receipt({entryCostUsdc:'1'});
 const result=createIdleCapitalComparisonReceipt(a,b,{generatedAt:'2026-11-25T12:00:00.000Z'});
 assert.equal(result.snapshots.a.scenario.marketSource.retrievedAt,at);
 assert.equal(result.snapshots.a.scenario.marketSource.liquidityAsOf,at);
 assert.equal(result.comparison.inputsDiffer,true);
 const html=idleCapitalComparisonHtml({a,b,receipt:result,error:false});
 assert.ok(!html.includes('<img')); assert.match(html,/&lt;img/);
});
test('comparison controls and summaries have all four non-English translations', async () => {
 const { translateHolderText } = await import('../packages/ui/holder-i18n.js');
 for(const lang of ['zh','ja','hi','es']) for(const label of ['Saved USDC scenarios','SAVE AS SCENARIO A','SAVE AS SCENARIO B','DOWNLOAD SCENARIO COMPARISON','CLEAR SAVED SCENARIOS','B minus A','The times until funds are needed differ; differences are hidden.']) assert.notEqual(translateHolderText(label,lang),label);
});
