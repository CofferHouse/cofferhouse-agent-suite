// USDC accounting uses integer micro-units. A plan never moves funds.
export function usdcUnits(value) {
  if (typeof value !== 'string' || !/^\d{1,18}(\.\d{1,6})?$/.test(value)) throw new Error('USDC amounts require an unsigned decimal string with at most six decimals.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}
const format = value => `${value / 1_000_000n}.${String(value % 1_000_000n).padStart(6, '0')}`;

export function planUsdcRevenue({ confirmedRevenueUsdc, costsUsdc, reserveUsdc, buybackBps, holderBps }) {
  const gross = usdcUnits(confirmedRevenueUsdc);
  const costs = usdcUnits(costsUsdc);
  const reserve = usdcUnits(reserveUsdc);
  if (![buybackBps, holderBps].every(n => Number.isInteger(n) && n >= 0 && n <= 10_000) || buybackBps + holderBps > 10_000) throw new Error('Explicit allocations must total at most 10,000 basis points.');
  if (costs + reserve > gross) throw new Error('Costs and reserve exceed confirmed revenue.');
  const distributable = gross - costs - reserve;
  const buyback = distributable * BigInt(buybackBps) / 10_000n;
  const holders = distributable * BigInt(holderBps) / 10_000n;
  return {
    schema: 'cofferhouse.treasury.revenue-plan.v1',
    confirmedRevenueUsdc: format(gross), costsUsdc: format(costs), reserveUsdc: format(reserve),
    distributableUsdc: format(distributable), buybackBudgetUsdc: format(buyback), holderBudgetUsdc: format(holders),
    retainedUsdc: format(distributable - buyback - holders), allocations: { buybackBps, holderBps },
    execution: { prepared: false, signed: false, submitted: false },
    notice: 'Planning only. Confirmed revenue must exclude deposits, loan principal and unsettled payments. A DEX quote, protected execution and a verified burn are separate steps. Holder budget is not an individual reward entitlement.'
  };
}

export function evaluateBotBudget({ amountUsdc, spentUsdc, perActionCapUsdc, periodCapUsdc, balanceUsdc, reserveUsdc, paused, expiresAt, now = () => new Date() }) {
  const [amount, spent, actionCap, periodCap, balance, reserve] = [amountUsdc, spentUsdc, perActionCapUsdc, periodCapUsdc, balanceUsdc, reserveUsdc].map(usdcUnits);
  const at = now().getTime();
  const expiry = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
  const blockers = [];
  if (paused !== false) blockers.push('Bot must be explicitly unpaused.');
  if (!Number.isFinite(at) || !Number.isFinite(expiry) || at >= expiry) blockers.push('Budget authorization is expired or invalid.');
  if (actionCap === 0n || actionCap > periodCap) blockers.push('Invalid budget caps.');
  if (amount === 0n || amount > actionCap) blockers.push('Per-operation budget exceeded or amount is zero.');
  if (spent + amount > periodCap) blockers.push('Period budget exceeded.');
  if (amount + reserve > balance) blockers.push('Operation would consume the protected reserve.');
  return { schema: 'cofferhouse.bot.budget-check.v1', decision: blockers.length ? 'BLOCK' : 'WITHIN_BUDGET', blockers,
    execution: { prepared: false, signed: false, submitted: false },
    notice: 'Budget check only. A future executor must atomically reserve spending, verify chain and contract allowlists, enforce quote freshness and slippage, and require installed wallet permissions.' };
}
