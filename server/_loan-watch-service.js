const registryKey = 'cofferhouse:guardian:loan-watches:v1';
const walletKey = wallet => 'cofferhouse:alerts:telegram:wallet:' + wallet.toLowerCase();
const chatKey = chat => 'cofferhouse:alerts:telegram:chat:' + chat;
const stateKey = watch => 'cofferhouse:guardian:loan-watch-state:' + watch.id;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export class LoanWatchError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Every side effect is injected; the default runtime is wired separately.
export function createLoanWatchService({get,cas,getPosition,evaluate,send,id,now = () => new Date(), maxRunMs = 15_000}) {
  async function subscription(wallet, linkedAt) {
    const sub = await get(walletKey(wallet));
    if (sub?.schema !== 'cofferhouse.telegram.subscription.v1' || !sub.active || !same(sub.walletAddress,wallet) || sub.linkedAt !== linkedAt) return null;
    // Private financial notices must never be sent to a group/channel.
    if (!/^[1-9]\d*$/.test(String(sub.chatId)) || String(sub.chatId) !== String(sub.telegramUserId)) return null;
    const owner = await get(chatKey(sub.chatId));
    return same(owner?.walletAddress,wallet) && owner.linkedAt === linkedAt ? sub : null;
  }
  async function session(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{32}$/i.test(token)) throw new LoanWatchError('A private connected alert session is required.',401);
    const status = await get('cofferhouse:alerts:telegram:status:' + token);
    if (status?.status !== 'CONNECTED' || !/^0x[0-9a-f]{40}$/i.test(status.walletAddress ?? '') || !status.linkedAt) throw new LoanWatchError('Alert session is not connected.',401);
    const sub = await subscription(status.walletAddress,status.linkedAt);
    if (!sub) throw new LoanWatchError('Reconnect alerts in a private Telegram chat.',401);
    return sub;
  }
  async function manage({token, action = 'LIST', loanId, consent = false}) {
    const sub = await session(token);
    if (!['LIST','ADD','REMOVE'].includes(action)) throw new LoanWatchError('Unsupported watch action.');
    const wallet = sub.walletAddress.toLowerCase();
    if (action !== 'LIST' && !uuid(loanId)) throw new LoanWatchError('A complete loan UUID is required.');
    if (action === 'ADD') {
      if (consent !== true || sub.preferences?.guardianAttention === false) throw new LoanWatchError('Explicit loan-alert consent and enabled Guardian alerts are required.');
      let position;
      try { position = await getPosition({loanId}); } catch { throw new LoanWatchError('Unable to verify the loan with its provider.',503); }
      if (!same(position?.loanId,loanId) || !same(position?.wallet,wallet) || position?.chain !== 'Arc') throw new LoanWatchError('Loan does not match the connected Arc wallet.',422);
      if (!await subscription(wallet,sub.linkedAt)) throw new LoanWatchError('Alert connection changed; reconnect first.',401);
    }
    const watchId = action === 'ADD' ? id() : null;
    if (action === 'ADD' && !uuid(watchId)) throw new LoanWatchError('Unable to create a watch identifier.',503);
    for (let attempt = 0; attempt < 8; attempt++) {
      const stored = await get(registryKey);
      if (stored !== null && !Array.isArray(stored)) throw new LoanWatchError('Watch registry requires review.',503);
      const watches = stored ?? [];
      const owned = watches.filter(w => same(w.walletAddress,wallet));
      if (action === 'LIST') return owned.map(w => ({id:w.id,loanId:w.loanId,registeredAt:w.registeredAt,connectedSession:w.linkedAt===sub.linkedAt}));
      const matching = w => same(w.walletAddress,wallet) && same(w.loanId,loanId);
      let next;
      if (action === 'REMOVE') next = watches.filter(w => !matching(w));
      else {
        const existing = watches.find(w => matching(w) && w.linkedAt === sub.linkedAt);
        if (existing) return {id:existing.id,loanId:existing.loanId,registered:true,replayed:true};
        next = watches.filter(w => !matching(w));
        if (next.length >= 20 || next.filter(w => same(w.walletAddress,wallet)).length >= 5) throw new LoanWatchError('Loan watch capacity reached.',409);
        next.push({schema:'cofferhouse.guardian.loan-watch.v1',id:watchId,loanId:loanId.toLowerCase(),walletAddress:wallet,linkedAt:sub.linkedAt,registeredAt:now().toISOString(),consent:true});
      }
      if (await cas(registryKey,stored,next)) return {registered:action==='ADD',id:watchId,loanId:loanId.toLowerCase()};
    }
    throw new LoanWatchError('Concurrent watch updates; retry the same action.',503);
  }
  async function run() {
    const summary = {processed:0,alerted:0,held:0,skipped:0,deferred:0};
    const deadline = now().getTime() + maxRunMs;
    const watches = await get(registryKey);
    if (watches === null) return summary;
    if (!Array.isArray(watches) || watches.length > 20) throw new LoanWatchError('Watch registry requires review.',503);
    const cursorKey = registryKey + ':cursor';
    const cursor = await get(cursorKey);
    const start = Math.max(0,watches.findIndex(w => w.id === cursor?.nextId));
    const ordered = [...watches.slice(start),...watches.slice(0,start)];
    let visited = 0;
    for (const watch of ordered) {
      if (now().getTime() >= deadline) { summary.deferred = ordered.length - visited; break; }
      visited++;
      try {
        if (watch?.schema !== 'cofferhouse.guardian.loan-watch.v1' || !uuid(watch.id) || !uuid(watch.loanId) || watch.consent !== true) { summary.skipped++; continue; }
        const sub = await subscription(watch.walletAddress,watch.linkedAt);
        if (!sub || sub.preferences?.guardianAttention === false) { summary.skipped++; continue; }
        summary.processed++;
        let band = 'UNAVAILABLE';
        try {
          const position = await getPosition({loanId:watch.loanId});
          if (same(position?.loanId,watch.loanId) && same(position?.wallet,watch.walletAddress) && position?.chain === 'Arc') {
            const assessment = evaluate({position,observedAt:now().toISOString(),now});
            band = ['MONITOR','NO_DEBT'].includes(assessment.decision) ? assessment.decision
              : ['WARN','URGENT','IMMINENT','LIQUIDATABLE'].includes(assessment.healthFactorBand) ? assessment.healthFactorBand : 'UNAVAILABLE';
          }
        } catch { /* No healthy-position claim or foreign position data. */ }
        const previous = await get(stateKey(watch));
        if (previous?.band === band) { summary.skipped++; continue; }
        const alerts = !['MONITOR','NO_DEBT'].includes(band);
        const event = {band,revision:(previous?.revision ?? 0)+1,delivery:alerts?'CLAIMED':'NOT_REQUIRED',observedAt:now().toISOString()};
        if (!await cas(stateKey(watch),previous,event)) { summary.skipped++; continue; }
        if (!alerts) continue;
        // Check revocation and chat ownership again immediately before delivery.
        const liveRegistry = await get(registryKey);
        const liveSub = await subscription(watch.walletAddress,watch.linkedAt);
        const liveEvent = await get(stateKey(watch));
        if (JSON.stringify(liveEvent) !== JSON.stringify(event)) { summary.skipped++; continue; }
        if (!Array.isArray(liveRegistry) || !liveRegistry.some(w => w.id === watch.id) || !liveSub || liveSub.preferences?.guardianAttention === false) {
          await cas(stateKey(watch),event,{...event,delivery:'CANCELLED'});
          summary.skipped++; continue;
        }
        try {
          const text = 'CofferHouse Guardian — loan ' + watch.loanId.slice(0,8) + '\nStatus: ' + band + '\n'
            + (band === 'UNAVAILABLE' ? 'Loan data could not be verified. Open Holder Center and check the position.' : 'Review your loan collateral and repayment options in Holder Center.')
            + '\nNo transaction or automatic repayment was performed.';
          const result = await send({chatId:liveSub.chatId,text});
          if (result?.delivered !== true) throw new Error('Delivery was not confirmed');
          await cas(stateKey(watch),event,{...event,delivery:'DELIVERED',deliveredAt:now().toISOString()});
          summary.alerted++;
        } catch {
          // Telegram lacks an exactly-once send key. Preserve an ambiguous claim
          // after a timeout/crash rather than automatically sending it twice.
          await cas(stateKey(watch),event,{...event,delivery:'UNKNOWN'});
          summary.held++;
        }
      } catch { summary.held++; }
    }
    if (ordered.length) await cas(cursorKey,cursor,{nextId:ordered[visited % ordered.length].id});
    return summary;
  }
  return {manage,run};
}
