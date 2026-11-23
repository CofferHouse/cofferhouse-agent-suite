import { sealDocument } from './integrity.js';

export function createIdleCapitalReceipt(plan, { generatedAt = new Date().toISOString(), example = false } = {}) {
  if (plan?.schema !== 'cofferhouse.treasury.idle-capital-plan.v1' || !['KEEP_LIQUID', 'REVIEW_REQUIRED'].includes(plan.decision)) throw new Error('A valid idle-capital scenario is required.');
  return sealDocument({
    schema: 'cofferhouse.treasury.idle-capital-receipt.v1',
    generatedAt, sourceAgent: 'CofferHouse Strategy Lab',
    inputSource: plan.mode === 'EARN_LIQUIDITY_WITH_CALLER_ASSUMPTIONS' ? (example ? 'EARN_LIQUIDITY_WITH_EDITABLE_SYNTHETIC_CASH' : 'EARN_LIQUIDITY_WITH_USER_ASSUMPTIONS') : example ? 'EDITABLE_SYNTHETIC_EXAMPLE' : 'USER_ENTERED_SCENARIO',
    scenario: plan,
    notice: 'Integrity seal only. Entered balances, liquidity, costs, withdrawal timing and rate are not authenticated. No transaction is authorized.'
  }, 'idle-capital');
}

