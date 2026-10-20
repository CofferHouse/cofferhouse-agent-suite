import { randomUUID } from 'node:crypto';
import { BorrowKit } from '@circle-fin/borrow-kit';
import { getJson, compareAndSetJson, durableStoreConfigured, consumeLoanWatchRequest } from './_redis.js';
import { sendTelegramMessage, telegramConfigured } from './_notify.js';
import { evaluateLoanHealth } from '../packages/agent-modules/loan-health.js';
import { createLoanWatchService } from './_loan-watch-service.js';

const kit = new BorrowKit({disableErrorReporting:true});
async function observe(params) {
  let timer;
  try {
    return await Promise.race([
      kit.getPosition(params),
      new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('Observation timeout')),5000); })
    ]);
  } finally { clearTimeout(timer); }
}
export const loanWatchService = createLoanWatchService({
  get:getJson,cas:compareAndSetJson,consume:consumeLoanWatchRequest,getPosition:observe,evaluate:evaluateLoanHealth,id:randomUUID,
  send:request => sendTelegramMessage(request,process.env,(url,options) => fetch(url,{...options,signal:AbortSignal.timeout(5000)}))
});
export async function runLoanWatchCycle() {
  if (process.env.GUARDIAN_LOAN_WATCH_ENABLED !== 'true' || !durableStoreConfigured() || !telegramConfigured())
    return {enabled:false,processed:0,alerted:0,held:0,skipped:0,deferred:0};
  try { return {enabled:true,...await loanWatchService.run()}; }
  catch { return {enabled:true,processed:0,alerted:0,held:1,skipped:0,deferred:0}; }
}
