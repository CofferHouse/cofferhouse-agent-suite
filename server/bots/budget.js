import { timingSafeEqual } from 'node:crypto';
import { createBudgetLedger, BudgetError } from '../_budget-ledger.js';
import { durableStoreConfigured } from '../_redis.js';

export function createBudgetHandler({ update = createBudgetLedger(), configured = durableStoreConfigured, token = () => process.env.SCOUT_OPERATOR_TOKEN } = {}) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return response.status(405).json({ ok: false, error: 'Method not allowed' });
    const expected = token();
    const supplied = request.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!expected || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return response.status(401).json({ ok: false, error: 'Unauthorized' });
    if (!configured()) return response.status(503).json({ ok: false, error: 'Durable budget store is unavailable.' });
    try {
      if (Number(request.headers?.['content-length'] ?? 0) > 4096 || Buffer.byteLength(JSON.stringify(request.body ?? '')) > 4096) return response.status(413).json({ ok: false, error: 'Request body too large' });
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) return response.status(400).json({ ok: false, error: 'A budget request object is required.' });
      const result = await update(body);
      return response.status(200).json({ ok: true, budget: result });
    } catch (error) {
      if (error instanceof SyntaxError || /USDC amounts require/.test(error.message)) return response.status(400).json({ ok: false, error: 'Invalid budget request.' });
      if (error instanceof BudgetError) return response.status(error.status).json({ ok: false, error: error.message });
      return response.status(503).json({ ok: false, error: 'Budget update unavailable; retry with the same operation ID. No execution was authorized.' });
    }
  };
}
export default createBudgetHandler();
