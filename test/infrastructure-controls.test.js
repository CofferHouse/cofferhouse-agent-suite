import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoanHealth } from '../packages/agent-modules/loan-health.js';
import { evaluateGuardian } from '../packages/agent-modules/guardian.js';
import { healthFactorBand, normalizeBorrowPreview } from '../packages/agent-modules/borrow-kit.js';
import { planUsdcRevenue, evaluateBotBudget } from '../packages/agent-modules/treasury-plan.js';
import { createLoanHealthHandler } from '../server/guardian/loan-health.js';
const now = () => new Date('2026-10-19T22:00:00Z');
const position = { loanId:'11111111-1111-4111-8111-111111111111', marketId:'market', wallet:`0x${'1'.repeat(40)}`, chain:'Arc', dataStatus:'READY', borrowed:{token:'USDC',amount:'100'}, healthFactor:1.3, ltv:0.6, status:'active' };
const assess = p => evaluateLoanHealth({position:p, observedAt:now().toISOString(), now});
test('loan health bands, pending and missing debt never become healthy', () => {
  for (const [health,band] of [[1.2,'SAFE'],[1.19,'WARN'],[1.09,'URGENT'],[1.04,'IMMINENT'],[0.99,'LIQUIDATABLE']]) {
    const result=assess({...position,healthFactor:health});
    assert.equal(result.healthFactorBand,band);
    assert.equal(result.requiresHumanAttention,health<1.2);
  }
  for (const value of [null,undefined,'',false,NaN,Infinity,-1]) assert.equal(healthFactorBand(value),'UNAVAILABLE');
  assert.equal(normalizeBorrowPreview({quote:{resultingHealthFactor:null}}).resultingHealthFactor,null);
  assert.equal(assess({...position,dataStatus:'PENDING',borrowed:null}).decision,'REVIEW');
  assert.equal(assess({...position,healthFactor:null}).decision,'REVIEW');
  assert.equal(assess({...position,borrowed:{token:'USDC',amount:'0'},healthFactor:null}).decision,'NO_DEBT');
  assert.equal(evaluateLoanHealth({position,observedAt:'2026-10-19T21:00:00Z',now}).decision,'REVIEW');
});
test('Guardian fails closed on stale, missing, future or mismatched source observations', () => {
  const evidence={source:'LENDING',targetId:'market',observedAt:now().toISOString(),status:'PASS',liquidityUsd:100,utilizationPct:40,priceChange24hPct:null,modeledImpactPct:null};
  const watch={schema:'cofferhouse.guardian.watch.v1',source:'LENDING',target:{id:'market'},baseline:evidence,limits:{liquidityDropPct:10,utilizationRisePoints:5}};
  assert.equal(evaluateGuardian(watch,evidence,now).decision,'HOLD_RESEARCH');
  for (const patch of [{observedAt:null},{observedAt:'2026-10-19T21:00:00Z'},{observedAt:'2026-10-19T23:00:00Z'},{source:'DEX'},{status:'UNKNOWN'},{liquidityUsd:null},{utilizationPct:null}]) assert.equal(evaluateGuardian(watch,{...evidence,...patch},now).decision,'REVIEW');
});
test('USDC plans conserve every micro-unit and never allocate principal implicitly', () => {
  const result=planUsdcRevenue({confirmedRevenueUsdc:'100.000001',costsUsdc:'10',reserveUsdc:'20',buybackBps:2500,holderBps:5000});
  assert.equal(result.buybackBudgetUsdc,'17.500000');
  assert.equal(result.holderBudgetUsdc,'35.000000');
  assert.equal(result.retainedUsdc,'17.500001');
  assert.equal(result.execution.submitted,false);
  assert.throws(()=>planUsdcRevenue({confirmedRevenueUsdc:'10',costsUsdc:'5',reserveUsdc:'6',buybackBps:0,holderBps:0}),/exceed/);
  assert.throws(()=>planUsdcRevenue({confirmedRevenueUsdc:'10',costsUsdc:'0',reserveUsdc:'0',buybackBps:6000,holderBps:5000}),/allocations/);
});
test('bot budget protects period caps, reserve, pause and expiration', () => {
  const request={amountUsdc:'10',spentUsdc:'80',perActionCapUsdc:'10',periodCapUsdc:'100',balanceUsdc:'30',reserveUsdc:'20',paused:false,expiresAt:'2026-10-19T23:00:00Z',now};
  assert.equal(evaluateBotBudget(request).decision,'WITHIN_BUDGET');
  for(const patch of [{spentUsdc:'95'},{balanceUsdc:'29.999999'},{paused:true},{expiresAt:now().toISOString()}]) assert.equal(evaluateBotBudget({...request,...patch}).decision,'BLOCK');
  assert.throws(()=>evaluateBotBudget({...request,amountUsdc:'-1'}),/USDC/);
});
const response=()=>({statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}});
test('protected loan endpoint fetches server economics, checks identity and handles failure', async () => {
  let calls=0;
  const handler=createLoanHealthHandler({getPosition:async()=>{calls++;return position;},now,operatorToken:()=> 'secret'});
  let res=response();await handler({method:'POST',headers:{},body:{}},res);assert.equal(res.statusCode,401);assert.equal(calls,0);
  const req={method:'POST',headers:{authorization:'Bearer secret'},body:{loanId:position.loanId,wallet:position.wallet,healthFactor:999}};
  res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.equal(res.body.assessment.healthFactor,1.3);
  res=response();await handler({...req,body:{...req.body,wallet:`0x${'2'.repeat(40)}`}},res);assert.equal(res.statusCode,422);
  const failed=createLoanHealthHandler({getPosition:async()=>{throw Error('private provider error');},now,operatorToken:()=> 'secret'});
  res=response();await failed(req,res);assert.equal(res.statusCode,502);assert.ok(!JSON.stringify(res.body).includes('private provider'));
});
