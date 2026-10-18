export const demoPaths = Object.freeze({range: [100, 94, 106, 96, 105, 100], rising: [100, 104, 108, 112, 116, 120], falling: [100, 94, 88, 82, 76, 70]});
export function simulateBot({kind = 'ddca', capital = 1000, feeBps = 20, scenario = 'range'} = {}) {
  if (!['ddca', 'grid'].includes(kind) || !demoPaths[scenario] || !Number.isFinite(capital) || capital < 10 || capital > 100000 || !Number.isFinite(feeBps) || feeBps < 0 || feeBps > 100) throw new RangeError('Invalid demo inputs');
  const prices = demoPaths[scenario];
  const feeRate = feeBps / 10000;
  let cash = capital, units = 0, fees = 0;
  const orders = [];
  const buy = (price, spend, step) => {
    const fee = spend * feeRate;
    units += (spend - fee) / price; cash -= spend; fees += fee;
    orders.push({step, side: 'BUY', price, fee});
  };
  const sell = (price, step) => {
    const gross = units * price, fee = gross * feeRate;
    cash += gross - fee; units = 0; fees += fee;
    orders.push({step, side: 'SELL', price, fee});
  };
  prices.forEach((price, step) => {
    if (kind === 'ddca') buy(price, capital / prices.length, step);
    else {
      // One illustrative spot bracket, no leverage; full fill assumed at crossed level.
      if (step > 0 && prices[step - 1] > 95 && price <= 95 && units === 0 && cash >= capital / 4) buy(95, capital / 4, step);
      else if (step > 0 && prices[step - 1] < 105 && price >= 105 && units > 0) sell(105, step);
    }
  });
  const equity = cash + units * prices.at(-1);
  return {cash, units, fees, equity, pnl: equity - capital, orders, prices};
}
export const scannerSamples = Object.freeze([
  {chain: 'Arc', name: 'Example A', liquidity: 120000, risk: 'Review'},
  {chain: 'Ethereum', name: 'Example B', liquidity: 800000, risk: 'Review'},
  {chain: 'Base', name: 'Example C', liquidity: 25000, risk: 'High'}
]);
export function filterScanner(chain = 'all', minLiquidity = 0) {
  return scannerSamples.filter(item => (chain === 'all' || chain === item.chain) && item.liquidity >= minLiquidity);
}
