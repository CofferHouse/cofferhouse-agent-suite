import { sealDocument } from './integrity.js';
import { captureIdleCapitalScenario } from '../agent-modules/idle-capital-comparison.js';
import { reviewIdleCapitalSource } from '../agent-modules/idle-source-review.js';

export function createIdleSourceReviewReceipt(saved, data, { now = Date.now() } = {}) {
  const snapshots = Object.fromEntries(['a','b'].filter(key => saved[key]).map(key => [key, captureIdleCapitalScenario(saved[key])]));
  if (!Object.keys(snapshots).length) throw new Error('Save a scenario before reviewing its source.');
  return sealDocument({ schema: 'cofferhouse.treasury.idle-source-review-receipt.v1', generatedAt: new Date(now).toISOString(),
    snapshots, reviews: Object.entries(snapshots).map(([slot, receipt]) => ({ slot, ...reviewIdleCapitalSource(receipt, data, { now }) })),
    execution: { prepared: false, signed: false, submitted: false },
    notice: 'Provider-report review, not live monitoring, authenticated funds or an investment instruction. Original scenarios and their source timestamps remain unchanged.',
  }, 'idle-source-review');
}
