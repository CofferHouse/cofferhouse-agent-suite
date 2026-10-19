import { healthFactorBand } from './borrow-kit.js';

const finite = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

// Read-only assessment of a provider observation, never transaction authority.
export function evaluateLoanHealth({ position, observedAt, now = () => new Date() }) {
  const evaluatedAt = now();
  if (!Number.isFinite(evaluatedAt.getTime())) throw new Error('Invalid evaluation time.');
  const debt = finite(position?.borrowed?.amount);
  const health = finite(position?.healthFactor);
  const ltv = finite(position?.ltv);
  const age = evaluatedAt.getTime() - (observedAt ? Date.parse(observedAt) : NaN);
  const reasons = [];
  let decision = 'REVIEW';
  let band = 'UNAVAILABLE';
  if (!Number.isFinite(age) || age < -30_000 || age > 60_000) reasons.push('A fresh provider observation is required.');
  if (position?.dataStatus !== 'READY') reasons.push('Provider position economics are not ready.');
  if (!position?.loanId || !position?.marketId || !position?.wallet || position?.chain !== 'Arc') reasons.push('An identified Arc loan is required.');
  if (position?.borrowed?.token !== 'USDC' || debt === null) reasons.push('Verified USDC debt data is required.');
  if (!['active', 'closed'].includes(position?.status)) reasons.push('Unknown position lifecycle.');
  if (!reasons.length) {
    if (debt === 0) { decision = 'NO_DEBT'; band = 'NO_DEBT'; }
    else if (position.status !== 'active' || health === null || ltv === null) reasons.push('Active debt requires complete health and LTV data.');
    else {
      band = healthFactorBand(health);
      decision = health >= 1.2 ? 'MONITOR' : 'HUMAN_ATTENTION';
      if (health < 1.2) reasons.push(`Loan health is ${band}; review collateral or repayment.`);
    }
  }
  return {
    schema: 'cofferhouse.guardian.loan-health.v1', evaluatedAt: evaluatedAt.toISOString(), observedAt: observedAt ?? null,
    loanId: position?.loanId ?? null, marketId: position?.marketId ?? null, wallet: position?.wallet ?? null,
    decision, healthFactorBand: band, healthFactor: health, ltv, debtUsdc: debt,
    liquidationPrice: finite(position?.liquidationPrice?.amount), reasons,
    requiresHumanAttention: !['MONITOR', 'NO_DEBT'].includes(decision),
    execution: { prepared: false, signed: false, submitted: false },
    notice: 'Provider-reported loan health, not an independent onchain verification. No repayment, collateral change or automatic exit is authorized.'
  };
}
