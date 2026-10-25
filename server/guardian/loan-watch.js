import { durableStoreConfigured } from '../_redis.js';
import { loanWatchService } from '../_loan-watch-runtime.js';
import { LoanWatchError } from '../_loan-watch-service.js';

export function createLoanWatchHandler({service=loanWatchService,configured=durableStoreConfigured,enabled=() => process.env.GUARDIAN_LOAN_WATCH_ENABLED === 'true'} = {}) {
  return async (request,response) => {
    response.setHeader('Cache-Control','no-store');
    if (request.method !== 'POST') return response.status(405).json({ok:false,error:'Method not allowed'});
    if (!configured() || !enabled()) return response.status(503).json({ok:false,error:'Loan alert watches are not enabled.'});
    try {
      if (Number(request.headers?.['content-length'] ?? 0)>4096 || Buffer.byteLength(JSON.stringify(request.body ?? ''))>4096)
        return response.status(413).json({ok:false,error:'Request body too large'});
      const body=typeof request.body==='string'?JSON.parse(request.body):request.body;
      if (!body || typeof body!=='object' || Array.isArray(body)) return response.status(400).json({ok:false,error:'A watch request object is required.'});
      const result=await service.manage({token:body.token,action:body.action,loanId:body.loanId,consent:body.consent,acceptDuplicate:body.acceptDuplicate});
      return response.status(200).json({ok:true,result});
    } catch(error) {
      if (error instanceof LoanWatchError) return response.status(error.status).json({ok:false,error:error.message});
      return response.status(error instanceof SyntaxError?400:503).json({ok:false,error:'Unable to update loan watches.'});
    }
  };
}
export default createLoanWatchHandler();
