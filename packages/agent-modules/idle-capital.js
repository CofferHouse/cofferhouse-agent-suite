import { usdcUnits } from './treasury-plan.js';

const money = value => `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 1000000n}.${String((value < 0n ? -value : value) % 1000000n).padStart(6, '0')}`;
const minimum = (...values) => values.reduce((a, b) => a < b ? a : b);
function hours(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8760) throw new Error('Hours must be integers in 0..8760.');
  return BigInt(value);
}

/** Caller-entered, single-vault USDC sensitivity model; never a live allocation. */
export function planIdleUsdc(input, { now = Date.now() } = {}) {
  const reasons = [];
  const fields = ['walletUsdc', 'reserveUsdc', 'committedUsdc', 'earmarkedUsdc', 'maxAllocationUsdc', 'vaultAvailableLiquidityUsdc', 'maxLiquidityShareBps', 'entryCostUsdc', 'exitCostUsdc', 'minimumNetScenarioUsdc', 'holdingHours', 'withdrawalLeadHours', 'scenarioAnnualSimpleRateBps', 'observedAt', 'withdrawalTermsReviewed', 'paused'];
  const assumptions = Object.fromEntries(fields.map(key => [key, ['string', 'number', 'boolean'].includes(typeof input?.[key]) ? input[key] : null]));
  let protectedUsdc = null, availableUsdc = null, modeledAllocationUsdc = null;
  let grossScenarioUsdc = null, netScenarioUsdc = null, earningHours = null;
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input required.');
    const [balance, reserve, commitments, earmarked, cap, liquidity, entry, exit, minimumNet] = [
      input.walletUsdc, input.reserveUsdc, input.committedUsdc, input.earmarkedUsdc,
      input.maxAllocationUsdc, input.vaultAvailableLiquidityUsdc,
      input.entryCostUsdc, input.exitCostUsdc, input.minimumNetScenarioUsdc,
    ].map(usdcUnits);
    const holding = hours(input.holdingHours), lead = hours(input.withdrawalLeadHours);
    if (!Number.isInteger(input.maxLiquidityShareBps) || input.maxLiquidityShareBps < 1 || input.maxLiquidityShareBps > 10000) throw new Error('Liquidity share required.');
    if (!Number.isInteger(input.scenarioAnnualSimpleRateBps) || input.scenarioAnnualSimpleRateBps < 0 || input.scenarioAnnualSimpleRateBps > 10000) throw new Error('Scenario rate required.');
    const observed = typeof input.observedAt === 'string' ? Date.parse(input.observedAt) : NaN;
    if (!Number.isFinite(now) || !Number.isFinite(observed) || observed > now || now - observed > 300000) reasons.push('STALE_OR_INVALID_OBSERVATION');
    if (input.withdrawalTermsReviewed !== true) reasons.push('WITHDRAWAL_TERMS_UNREVIEWED');
    if (input.paused !== false) reasons.push('POLICY_PAUSED');
    const protectedAmount = reserve + commitments + earmarked;
    protectedUsdc = money(protectedAmount);
    if (protectedAmount > balance) reasons.push('COMMITMENTS_EXCEED_WALLET');
    const available = balance > protectedAmount ? balance - protectedAmount : 0n;
    availableUsdc = money(available);
    const allocation = minimum(available, cap, liquidity * BigInt(input.maxLiquidityShareBps) / 10000n);
    modeledAllocationUsdc = money(allocation);
    earningHours = Number(holding > lead ? holding - lead : 0n);
    if (holding <= lead || lead === 0n) reasons.push('INSUFFICIENT_WITHDRAWAL_WINDOW');
    if (allocation === 0n) reasons.push('NO_DEPLOYABLE_CAPITAL');
    const gross = allocation * BigInt(input.scenarioAnnualSimpleRateBps) * BigInt(earningHours) / (10000n * 8760n);
    const net = gross - entry - exit;
    grossScenarioUsdc = money(gross);
    netScenarioUsdc = money(net);
    if (net <= minimumNet) reasons.push('SCENARIO_DOES_NOT_CLEAR_COSTS_AND_MARGIN');
  } catch { reasons.push('INVALID_INPUT'); }
  const clear = reasons.length === 0;
  return {
    schema: 'cofferhouse.treasury.idle-capital-plan.v1',
    mode: 'CALLER_ENTERED_SCENARIO',
    assumptions,
    decision: clear ? 'REVIEW_REQUIRED' : 'KEEP_LIQUID', reasons,
    protectedUsdc, availableUsdc, modeledAllocationUsdc,
    reviewableAllocationUsdc: clear ? modeledAllocationUsdc : '0.000000',
    earningHours, grossScenarioUsdc, netScenarioAfterEnteredCostsUsdc: netScenarioUsdc,
    rateModel: 'SIMPLE_ANNUAL_RATE_SENSITIVITY_NOT_APY_FORECAST',
    observationVerified: false, withdrawalGuaranteed: false, realizedProfitUsdc: null,
    humanApprovalRequired: true,
    execution: { prepared: false, signed: false, submitted: false },
    notice: 'Scenario only, not authorization or a return forecast. Reserve, commitments and earmarked amounts must be disjoint and include pending off-chain payment obligations. Exit liquidity can disappear; entered withdrawal timing, costs and rate are assumptions. Gas, execution fees and failed attempts must be included in costs. Credit losses, token depeg and capital loss are not modeled. Review live vault evidence and preserve settlement funds before any separate wallet action.',
  };
}
