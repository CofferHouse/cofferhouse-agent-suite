import { planIdleUsdc } from './idle-capital.js';
import { usdcUnits } from './treasury-plan.js';

const roundMoney = (value) => Math.round(value * 100) / 100;

function allocateWithVaultCaps(candidates, deployableUsd, perVaultCapUsd) {
  const allocations = candidates.map((candidate) => ({ candidate, amountUsd: 0 }));
  let remaining = deployableUsd;
  let active = allocations.slice();
  for (let pass = 0; pass <= allocations.length && remaining > 0.005 && active.length; pass += 1) {
    const totalWeight = active.reduce((sum, item) => sum + Math.max(item.candidate.researchScore, 1), 0);
    let distributed = 0;
    const next = [];
    for (const item of active) {
      const cap = Math.min(perVaultCapUsd, item.candidate.maxResearchAmountUsd);
      const room = Math.max(0, cap - item.amountUsd);
      const addition = Math.min(room, remaining * Math.max(item.candidate.researchScore, 1) / totalWeight);
      item.amountUsd += addition;
      distributed += addition;
      if (room - addition > 0.005) next.push(item);
    }
    if (distributed <= 0.005) break;
    remaining -= distributed;
    active = next;
  }
  return { allocations, remaining };
}

export function buildEarnStrategy(earnAnalysis, strategyPreferences, { idleCapitalInput, now = Date.now() } = {}) {
  if (earnAnalysis?.schema !== "cofferhouse.arc-app-kits.earn-analysis.v1") throw new Error("A valid Earn opportunity analysis is required.");
  const capitalUsd = Number(strategyPreferences.capitalUsd);
  const reserveUsd = capitalUsd * Number(strategyPreferences.reservePct) / 100;
  const deployableUsd = capitalUsd - reserveUsd;
  let idleCapitalPlan = null;
  let boundedDeployableUsd = deployableUsd;
  if (idleCapitalInput !== undefined) {
    if (!Number.isFinite(capitalUsd) || capitalUsd <= 0 || capitalUsd > 1_000_000_000 || usdcUnits(idleCapitalInput?.walletUsdc) !== usdcUnits(String(capitalUsd))) throw new Error('Idle wallet balance must match Strategy capital in USDC.');
    const times = [idleCapitalInput.observedAt, earnAnalysis.observedAt].map(value => typeof value === 'string' ? Date.parse(value) : NaN);
    const fresh = times.every(value => Number.isFinite(value) && value <= now && now - value <= 300000);
    idleCapitalInput = { ...idleCapitalInput, observedAt: fresh ? new Date(Math.min(...times)).toISOString() : 'invalid' };
    idleCapitalPlan = planIdleUsdc(idleCapitalInput, { now });
    // Round down to cents before entering the legacy USD research allocator.
    boundedDeployableUsd = Math.min(deployableUsd, Number(usdcUnits(idleCapitalPlan.reviewableAllocationUsdc) / 10000n) / 100);
  }
  const perVaultCapUsd = capitalUsd * Number(strategyPreferences.maxPerMarketPct) / 100;
  const candidates = earnAnalysis.opportunities
    .filter((item) => item.eligible && (!idleCapitalPlan || item.asset === 'USDC') && item.researchScore >= Number(strategyPreferences.minResearchScore) && item.maxResearchAmountUsd > 0)
    .slice(0, Number(strategyPreferences.maxMarkets));
  const allocation = allocateWithVaultCaps(candidates, boundedDeployableUsd, perVaultCapUsd);
  let positions = allocation.allocations.map(item => ({ ...item, amountUsd: idleCapitalPlan ? Math.floor(item.amountUsd * 100) / 100 : item.amountUsd })).filter((item) => item.amountUsd > 0.005).map(({ candidate, amountUsd }) => ({
    sourceType: "ARC_EARN_VAULT", vaultAddress: candidate.vaultAddress, name: candidate.name,
    protocol: candidate.protocol, asset: candidate.asset, amountUsd: roundMoney(amountUsd),
    portfolioPct: Math.round(amountUsd / capitalUsd * 10_000) / 100,
    observedApyPct: candidate.apyPct,
    annualizedObservedYieldUsd: roundMoney(amountUsd * (candidate.apyPct ?? 0) / 100),
    researchScore: candidate.researchScore, status: candidate.status, circleGuarded: candidate.circleGuarded,
    warnings: candidate.warnings,
    reviewConditions: [
      `Re-run Earn discovery before any action and confirm the vault remains ${candidate.status}.`,
      `Review if available liquidity falls below ${earnAnalysis.preferences.minAvailableLiquidityUsd} USD.`,
      `Do not exceed ${earnAnalysis.preferences.maxLiquiditySharePct}% of observed available liquidity.`,
      "A wallet-controlled deposit would require a separate fresh quote, human approval and signature."
    ]
  }));
  if (idleCapitalPlan) {
    const sizedUsdc = roundMoney(positions.reduce((sum, item) => sum + item.amountUsd, 0)).toFixed(2);
    idleCapitalPlan = planIdleUsdc({ ...idleCapitalInput, maxAllocationUsdc: sizedUsdc }, { now });
    // Actual vault caps may make the smaller scenario uneconomic after fixed costs.
    if (idleCapitalPlan.decision !== 'REVIEW_REQUIRED') positions = [];
  }
  const allocatedUsd = positions.reduce((sum, item) => sum + item.amountUsd, 0);
  const observedAnnualizedYieldUsd = positions.reduce((sum, item) => sum + item.annualizedObservedYieldUsd, 0);
  return Object.freeze({
    schema: "cofferhouse.arc-app-kits.earn-strategy.v1", sourceSchema: earnAnalysis.schema,
    source: earnAnalysis.source, chain: earnAnalysis.chain, observedAt: earnAnalysis.observedAt,
    preferences: { ...strategyPreferences }, status: positions.length ? "PROPOSAL_READY" : "NO_ELIGIBLE_ALLOCATION",
    summary: Object.freeze({
      capitalUsd, reserveUsd: roundMoney(reserveUsd), allocatedUsd: roundMoney(allocatedUsd),
      unallocatedUsd: roundMoney(Math.max(0, deployableUsd - allocatedUsd)), vaults: positions.length,
      weightedObservedApyPct: allocatedUsd ? Math.round(observedAnnualizedYieldUsd / allocatedUsd * 100_000) / 1000 : 0,
      observedAnnualizedYieldUsd: roundMoney(observedAnnualizedYieldUsd)
    }),
    positions, idleCapitalPlan,
    exclusions: earnAnalysis.opportunities.filter((item) => !positions.some((position) => position.vaultAddress === item.vaultAddress)).map((item) => ({
      vaultAddress: item.vaultAddress, name: item.name,
      reason: !item.eligible ? item.reason : item.researchScore < Number(strategyPreferences.minResearchScore) ? "Research score is below the Strategy minimum." : "Excluded by diversification or sizing limits."
    })),
    separationRule: "Arc Earn vault evidence remains separate from Morpho market evidence. Similar underlying exposure is not merged or counted twice.",
    notice: "Read-only allocation research. Observed APY is variable, not forecast or guaranteed. No recommendation, custody, approval, signature or execution."
  });
}
