import { sealDocument } from './integrity.js';
import { captureIdleCapitalScenario, compareIdleCapitalReceipts } from '../agent-modules/idle-capital-comparison.js';

export function createIdleCapitalComparisonReceipt(a, b, { generatedAt = new Date().toISOString() } = {}) {
  const snapshots = { a: captureIdleCapitalScenario(a), b: captureIdleCapitalScenario(b) };
  return sealDocument({ schema: 'cofferhouse.treasury.idle-comparison-receipt.v1', generatedAt,
    sourceAgent: 'CofferHouse Strategy Lab', snapshots,
    comparison: compareIdleCapitalReceipts(snapshots.a, snapshots.b),
    notice: 'Comparison time is not a new market observation. Original snapshot timestamps and input provenance are retained. Integrity is not authentication or investment approval.',
  }, 'idle-comparison');
}
