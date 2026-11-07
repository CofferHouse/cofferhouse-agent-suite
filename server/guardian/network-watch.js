import { timingSafeEqual } from "node:crypto";
import { compareAndSetJson, durableStoreConfigured, getJson } from "../_redis.js";
import { fetchNetworkMarket, networkMarketIdentity } from "../../packages/arc-data/morpho-network-target.js";
import { sealDocument } from "../../packages/evidence/index.js";
const KEY = "cofferhouse:guardian:network-markets:v1";
const LIMIT = 3;
const complete = m => m && Number.isFinite(m.liquidityUsd) && m.liquidityUsd >= 0 && Number.isFinite(m.utilizationPct) && m.utilizationPct >= 0 && m.utilizationPct <= 100;
export async function observeNetworkWatch(watch, {observe=fetchNetworkMarket} = {}) {
  let current=null, status="UNAVAILABLE", reasons=[];
  try {
    const next=await observe(watch);
    if (next.id !== watch.id || next.chainId !== watch.chainId || next.marketId !== watch.marketId) throw Error("Wrong market");
    current=next;
    if (!complete(current)) status="INCOMPLETE";
    else {
      if (current.liquidityUsd < watch.limits.minLiquidityUsd) reasons.push("LIQUIDITY_BELOW_MINIMUM");
      if (current.utilizationPct > watch.limits.maxUtilizationPct) reasons.push("UTILIZATION_ABOVE_MAXIMUM");
      if (!current.listed) reasons.push("LISTING_REQUIRES_REVIEW");
      if (current.asset?.address !== watch.baseline.asset?.address || current.collateral?.address !== watch.baseline.collateral?.address) reasons.push("ASSET_IDENTITY_CHANGED");
      status=reasons.length ? "REVIEW" : "WITHIN_LIMITS";
    }
  } catch { current=null; }
  return sealDocument({schema:"cofferhouse.guardian.network-watch-receipt.v1", generatedAt:new Date().toISOString(),target:watch.id,
    baseline:watch.baseline,current,status,reasons,limits:watch.limits,automatedAction:false},"guardian-network");
}
export async function runNetworkWatches({load=getJson,save=compareAndSetJson,observe=fetchNetworkMarket}={}) {
  const state=await load(KEY);
  if (!state?.length) return {count:0,saved:false};
  const next=await Promise.all(state.slice(0,LIMIT).map(async watch=>({...watch,latest:await observeNetworkWatch(watch,{observe})})));
  return {count:next.length,saved:await save(KEY,state,next)};
}
export function createNetworkWatchHandler({load=getJson,save=compareAndSetJson,observe=fetchNetworkMarket,configured=durableStoreConfigured,token=()=>process.env.SCOUT_OPERATOR_TOKEN}={}) {
  return async (request,response)=>{
    response.setHeader("Cache-Control","no-store");
    const expected=token(), raw=request.headers?.authorization;
    const supplied=Buffer.from(typeof raw==="string" && raw.startsWith("Bearer ") ? raw.slice(7) : "");
    if (!expected || supplied.length!==Buffer.byteLength(expected) || !timingSafeEqual(supplied,Buffer.from(expected))) return response.status(401).json({ok:false,error:"Unauthorized"});
    if (!["GET","POST","DELETE"].includes(request.method)) return response.status(405).json({ok:false,error:"Method not allowed"});
    if (!configured()) return response.status(503).json({ok:false,error:"Durable store unavailable"});
    try {
      const state=await load(KEY), watches=state ?? [];
      if (request.method==="GET") return response.status(200).json({ok:true,watches});
      const params=new URL(request.url ?? "/", "https://cofferhouse.invalid").searchParams;
      const chainId=request.method==="POST" ? request.body?.chainId : Number(request.query?.chainId ?? params.get("chainId"));
      const marketId=request.method==="POST" ? request.body?.marketId : request.query?.marketId ?? params.get("marketId");
      let id;
      try {id=networkMarketIdentity(chainId,marketId);} catch {return response.status(400).json({ok:false,error:"Invalid network market identity"});}
      let next=watches.filter(w=>w.id!==id);
      if (request.method==="POST") {
        const {approveBaseline,limits}=request.body;
        if (approveBaseline!==true || typeof limits?.minLiquidityUsd!=="number" || !Number.isFinite(limits.minLiquidityUsd) || limits.minLiquidityUsd<0 ||
            typeof limits?.maxUtilizationPct!=="number" || !Number.isFinite(limits.maxUtilizationPct) || limits.maxUtilizationPct<0 || limits.maxUtilizationPct>100) return response.status(400).json({ok:false,error:"Approve a baseline and explicit numeric limits"});
        if (next.length>=LIMIT) return response.status(409).json({ok:false,error:"Watch limit reached"});
        const target={id,chainId,marketId:marketId.toLowerCase()}, baseline=await observe(target);
        if (baseline.id!==id || baseline.chainId!==chainId || baseline.marketId!==target.marketId || !complete(baseline) || baseline.listed!==true) return response.status(422).json({ok:false,error:"Complete listed baseline required"});
        next.push({...target,limits:{minLiquidityUsd:limits.minLiquidityUsd,maxUtilizationPct:limits.maxUtilizationPct},baseline,approvedAt:new Date().toISOString(),latest:null});
      }
      if (!await save(KEY,state,next)) return response.status(409).json({ok:false,error:"Watch changed; retry"});
      return response.status(200).json({ok:true,watchCount:next.length});
    } catch {return response.status(503).json({ok:false,error:"Network watch unavailable"});}
  };
}
export default createNetworkWatchHandler();
