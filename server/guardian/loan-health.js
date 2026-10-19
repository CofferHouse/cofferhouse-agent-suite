import { timingSafeEqual } from 'node:crypto';
import { BorrowKit } from '@circle-fin/borrow-kit';
import { evaluateLoanHealth } from '../../packages/agent-modules/loan-health.js';

export function createLoanHealthHandler({ getPosition, now = () => new Date(), operatorToken = () => process.env.SCOUT_OPERATOR_TOKEN }) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return response.status(405).json({ ok: false, error: 'Method not allowed' });
    const expected = operatorToken();
    const supplied = request.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!expected || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return response.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      if (Number(request.headers?.['content-length'] ?? 0) > 4096 || Buffer.byteLength(JSON.stringify(request.body ?? '')) > 4096) return response.status(413).json({ ok: false, error: 'Request body too large' });
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.loanId ?? '') || !/^0x[0-9a-f]{40}$/i.test(body?.wallet ?? '')) return response.status(400).json({ ok: false, error: 'A loan UUID and expected owner wallet are required.' });
      // Fetch economics server-side. Never accept client-supplied health or debt.
      const position = await getPosition({ loanId: body.loanId });
      if (position?.loanId?.toLowerCase() !== body.loanId.toLowerCase() || position?.wallet?.toLowerCase() !== body.wallet.toLowerCase() || position?.chain !== 'Arc') return response.status(422).json({ ok: false, error: 'Provider position does not match the requested Arc loan and owner.' });
      const result = evaluateLoanHealth({ position, observedAt: now().toISOString(), now });
      return response.status(200).json({ ok: true, source: 'Circle Borrow Kit', assessment: result });
    } catch (error) {
      if (error instanceof SyntaxError) return response.status(400).json({ ok: false, error: 'Invalid JSON body' });
      return response.status(502).json({ ok: false, error: 'Loan observation unavailable. No healthy-position claim produced.' });
    }
  };
}
const kit = new BorrowKit({ disableErrorReporting: true });
export default createLoanHealthHandler({ getPosition: params => kit.getPosition(params) });
