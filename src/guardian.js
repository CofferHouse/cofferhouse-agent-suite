function numberOrNull(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

export function guardianEvidenceFromLending(market, report) {
  if (!market || !report) return null;
  return { source: "LENDING", targetId: market.marketId, observedAt: market.observedAt, status: report.status, score: report.score, liquidityUsd: numberOrNull(market.liquidityUsd), utilizationPct: numberOrNull(market.utilizationPct), priceChange24hPct: null, modeledImpactPct: null };
}

export function guardianEvidenceFromDex(report) {
  if (!report?.pool) return null;
  return { source: "DEX", targetId: report.pool.pairAddress, observedAt: report.pool.observedAt, status: report.status, score: report.score, liquidityUsd: numberOrNull(report.pool.liquidityUsd), utilizationPct: null, priceChange24hPct: numberOrNull(report.pool.priceChange24hPct), modeledImpactPct: numberOrNull(report.modeledLiquidityImpactPct) };
}

export function createGuardianWatch({ preview, approval, evidence, now = () => new Date() }) {
  if (preview?.schema !== "cofferhouse.action.preview.v1") throw new Error("A valid Action Center preview is required.");
  if (approval?.schema !== "cofferhouse.action.approval.v1") throw new Error("Human Action Center approval is required.");
  const createdAt = now();
  if (!Number.isFinite(new Date(approval.expiresAt).getTime()) || createdAt.getTime() > new Date(approval.expiresAt).getTime()) throw new Error("Action Center approval has expired.");
  if (!evidence || evidence.targetId?.toLowerCase() !== preview.target.id?.toLowerCase()) throw new Error("Current target evidence is required.");
  return { schema: "cofferhouse.guardian.watch.v1", createdAt: createdAt.toISOString(), target: preview.target, intent: preview.intent, source: preview.source, sourceReceiptId: preview.sourceReceiptId, approval: { operator: approval.operator, approvedAt: approval.approvedAt, expiresAt: approval.expiresAt }, baseline: evidence, limits: { liquidityDropPct: 10, utilizationRisePoints: 5, maxAbsPriceChange24hPct: 50, maxModeledImpactPct: 2 }, notice: "Research-intent monitoring only. No funded position, custody, automated exit or transaction is claimed." };
}

export function evaluateGuardian(watch, evidence, now = () => new Date()) {
  if (watch?.schema !== "cofferhouse.guardian.watch.v1") throw new Error("A valid Guardian watch is required.");
  const reasons = [];
  let decision = "HOLD_RESEARCH";
  if (!evidence || evidence.targetId?.toLowerCase() !== watch.target.id?.toLowerCase()) {
    decision = "STOP_EXIT_RESEARCH";
    reasons.push("The watched target is missing from the current observation.");
  } else {
    if (evidence.status === "REJECT") { decision = "STOP_EXIT_RESEARCH"; reasons.push("Current deterministic screening result is REJECT."); }
    else if (evidence.status === "REVIEW") { decision = "REVIEW"; reasons.push("Current deterministic screening result requires human review."); }
    if (watch.baseline.liquidityUsd !== null && evidence.liquidityUsd !== null && watch.baseline.liquidityUsd > 0) {
      const liquidityChangePct = (evidence.liquidityUsd - watch.baseline.liquidityUsd) / watch.baseline.liquidityUsd * 100;
      if (liquidityChangePct <= -watch.limits.liquidityDropPct) { decision = decision === "STOP_EXIT_RESEARCH" ? decision : "REVIEW"; reasons.push(`Liquidity changed ${liquidityChangePct.toFixed(2)}% from baseline.`); }
    }
    if (watch.baseline.utilizationPct !== null && evidence.utilizationPct !== null) {
      const rise = evidence.utilizationPct - watch.baseline.utilizationPct;
      if (rise >= watch.limits.utilizationRisePoints) { decision = decision === "STOP_EXIT_RESEARCH" ? decision : "REVIEW"; reasons.push(`Utilization increased ${rise.toFixed(2)} percentage points.`); }
    }
    if (evidence.priceChange24hPct !== null && Math.abs(evidence.priceChange24hPct) > watch.limits.maxAbsPriceChange24hPct) { decision = decision === "STOP_EXIT_RESEARCH" ? decision : "REVIEW"; reasons.push("24-hour price movement exceeds the Guardian limit."); }
    if (evidence.modeledImpactPct !== null && evidence.modeledImpactPct > watch.limits.maxModeledImpactPct) { decision = "STOP_EXIT_RESEARCH"; reasons.push("Modeled liquidity impact exceeds the Guardian limit."); }
  }
  if (!reasons.length) reasons.push("No monitored condition materially deteriorated from the recorded baseline.");
  return { schema: "cofferhouse.guardian.observation.v1", observedAt: now().toISOString(), target: watch.target, intent: watch.intent, decision, reasons, baseline: watch.baseline, current: evidence ?? null, requiresHumanAttention: decision !== "HOLD_RESEARCH", notice: "Guardian proposes a research response only. It cannot rebalance, withdraw, swap or execute." };
}
