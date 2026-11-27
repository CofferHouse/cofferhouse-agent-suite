import { canonicalJson, verifySealedDocument } from '../evidence/integrity.js';
import { captureIdleCapitalScenario } from './idle-capital-comparison.js';
import { reviewIdleCapitalSource } from './idle-source-review.js';
import { usdcUnits } from './treasury-plan.js';

export const defaultEarnGuardianLimits = Object.freeze({ liquidityDropPct: '10', apyDropPoints: '1' });
const rank = { INFO:0, REVIEW:1, DATA_GAP:2, HIGH:3 };
const fresh = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now && now - Date.parse(value) <= 300000;
function percent(value) {
  if (typeof value !== 'string' || !/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(value)) throw new Error('Use a decimal string from 0 to 100 with at most two decimals.');
  const [whole, fraction=''] = value.split('.'); return Number(whole)*100 + Number(fraction.padEnd(2,'0'));
}
const apyUnits = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000 ? BigInt(Math.round(value*1000000)) : null;
export function normalizeEarnGuardianLimits(values) {
  percent(values?.liquidityDropPct); percent(values?.apyDropPoints);
  return { liquidityDropPct:values.liquidityDropPct, apyDropPoints:values.apyDropPoints };
}
export function buildEarnGuardianSignals(review, values=defaultEarnGuardianLimits, {now=Date.now()}={}) {
  const limits=normalizeEarnGuardianLimits(values);
  if (!Number.isFinite(new Date(now).getTime()) || review?.schema !== 'cofferhouse.treasury.idle-source-review-receipt.v1' || JSON.stringify(review).length>160000 || !verifySealedDocument(review).valid || !Array.isArray(review.reviews) || review.reviews.length<1 || review.reviews.length>2 || !['prepared','signed','submitted'].every(key=>review.execution?.[key]===false)) throw new Error('A valid non-executable Earn source review is required.');
  const groups=new Map(), seen=new Set(); let manualScenarios=0;
  for(const report of review.reviews) {
    if (!['a','b'].includes(report.slot) || seen.has(report.slot)) throw new Error('Duplicate or unsupported review slot.');
    seen.add(report.slot);
    const snapshot=captureIdleCapitalScenario(review.snapshots?.[report.slot]), old=snapshot.scenario.marketSource??null;
    if (report.receiptId!==snapshot.receiptId || report.capturedAt!==snapshot.generatedAt || report.checkedAt!==review.generatedAt || canonicalJson(report.previous)!==canonicalJson(old)) throw new Error('Review and captured source are not bound.');
    if (!old) { if(report.status!=='NO_EARN_SOURCE'||report.current!==null) throw new Error('Invalid manual-source report.'); manualScenarios++; continue; }
    if (old.schema!=='cofferhouse.arc-earn.liquidity-source.v1'||old.chain!=='Arc'||old.asset!=='USDC'||!/^0x[0-9a-f]{40}$/i.test(old.vaultAddress)||/^0x0{40}$/.test(old.vaultAddress)) throw new Error('Unsupported Earn identity.');
    const id='Arc:'+old.vaultAddress.toLowerCase();
    if(!groups.has(id)) groups.set(id,{targetId:id,vaultAddress:old.vaultAddress,name:String(old.name).slice(0,256),priority:'INFO',references:[],findings:[]});
    const group=groups.get(id); group.references.push({slot:report.slot,scenarioReceiptId:snapshot.receiptId,reviewStatus:report.status});
    const add=(code,priority)=>{let finding=group.findings.find(item=>item.code===code);if(!finding){finding={code,priority,slots:[]};group.findings.push(finding);}if(!finding.slots.includes(report.slot))finding.slots.push(report.slot);if(rank[priority]>rank[group.priority])group.priority=priority;};
    const c=report.current;
    if(!fresh(review.generatedAt,now)||!c||!fresh(c.retrievedAt,now)||(c.liquidityAsOf!==null&&!fresh(c.liquidityAsOf,now))) {add('FRESH_EVIDENCE_REQUIRED','DATA_GAP');continue;}
    if(c.vaultAddress.toLowerCase()!==old.vaultAddress.toLowerCase()||c.asset!=='USDC') throw new Error('Current source identity mismatch.');
    const reconstructed={schema:'cofferhouse.arc-app-kits.earn.v1',source:'Circle Arc Earn Kit',chain:'Arc',mode:'official-read-only',retrievedAt:c.retrievedAt,vaults:[{vaultAddress:c.vaultAddress,name:c.name,protocol:c.protocol,asset:c.asset,status:c.status,availableLiquidityAssetAmount:c.amountUsdc,apyPct:c.reportedApyPct,liquidityAsOf:c.liquidityAsOf}]};
    const recomputed=reviewIdleCapitalSource(snapshot,reconstructed,{now:Date.parse(review.generatedAt)});
    const {slot,...stored}=report;
    if(canonicalJson(stored)!==canonicalJson(recomputed)) throw new Error('Review observations are internally inconsistent.');
    if(!c.status||c.status==='unknown')add('VAULT_STATUS_UNKNOWN','DATA_GAP');
    else if(c.status!=='active')add('VAULT_NOT_ACTIVE','HIGH');
    if(c.protocol!==old.protocol)add('PROTOCOL_CHANGED','HIGH');
    if(c.amountUsdc===null)add('LIQUIDITY_UNKNOWN','DATA_GAP');
    else {
      const before=usdcUnits(old.amountUsdc),current=usdcUnits(c.amountUsdc);
      if(before===0n)add('LIQUIDITY_BASELINE_UNKNOWN','DATA_GAP');
      if(current===0n)add('ZERO_LIQUIDITY','HIGH');
      if(before>current && (before-current)*10000n>=before*BigInt(percent(limits.liquidityDropPct)))add('LIQUIDITY_DROP_LIMIT','REVIEW');
      const share=snapshot.scenario.assumptions.maxLiquidityShareBps;
      if(!Number.isInteger(share)||share<1||share>10000)add('CAPTURED_LIMIT_UNKNOWN','DATA_GAP');
      else if(usdcUnits(snapshot.scenario.reviewableAllocationUsdc)>current*BigInt(share)/10000n)add('CAPTURED_SIZE_EXCEEDS_SHARE','HIGH');
    }
    const oldApy=apyUnits(old.reportedApyPct),newApy=apyUnits(c.reportedApyPct);
    if(oldApy===null||newApy===null)add('APY_UNKNOWN','DATA_GAP');
    else if(oldApy>newApy && oldApy-newApy>=BigInt(percent(limits.apyDropPoints))*10000n)add('APY_DROP_LIMIT','REVIEW');
  }
  const targets=[...groups.values()].sort((a,b)=>rank[b.priority]-rank[a.priority]||a.targetId.localeCompare(b.targetId));
  return {schema:'cofferhouse.guardian.earn-signals.v1',mode:'DATED_EARN_REVIEW_ONLY',evaluatedAt:new Date(now).toISOString(),sourceReviewReceiptId:review.receiptId,sourceReviewAt:review.generatedAt,limits,targets,manualScenarios,attentionTargets:targets.filter(target=>target.priority!=='INFO').length,liveWatchRegistered:false,delivery:{sent:false},execution:{prepared:false,signed:false,submitted:false},notice:'Research attention only. Signals derive from a dated provider report, not authenticated funds or current investment eligibility. No watch registration, Telegram delivery, withdrawal or automatic exit is performed.'};
}
