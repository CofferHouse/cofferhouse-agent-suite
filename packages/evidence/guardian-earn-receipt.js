import { sealDocument } from './integrity.js';
import { buildEarnGuardianSignals,defaultEarnGuardianLimits } from '../agent-modules/guardian-earn-signals.js';
export function createGuardianEarnReceipt(review,limits=defaultEarnGuardianLimits,options) {
  const signals=buildEarnGuardianSignals(review,limits,options);
  return sealDocument({schema:'cofferhouse.guardian.earn-receipt.v1',generatedAt:signals.evaluatedAt,sourceReview:structuredClone(review),signals},'guardian-earn');
}
