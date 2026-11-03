// Centralized spot observations are kept separate from Arc lending evidence.
export const coinbaseProducts = Object.freeze(['BTC-USD', 'ETH-USD', 'BTC-USDC', 'ETH-USDC']);
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,18})?$/.test(value) && Number.isFinite(Number(value));
export function normalizeCoinbaseProduct(data, productId, observedAt) {
  if (!coinbaseProducts.includes(productId) || data?.product_id !== productId || data.product_type !== 'SPOT' || data.base_currency_id !== productId.split('-')[0] || data.quote_currency_id !== productId.split('-')[1]) throw new Error('Coinbase product identity mismatch.');
  if (!decimal(data.price) || Number(data.price) <= 0 || !Number.isFinite(Date.parse(observedAt))) throw new Error('Coinbase price evidence is unavailable.');
  return { schema: 'cofferhouse.coinbase.market.v1', source: 'Coinbase Advanced public API', productId, productType: 'SPOT', base: data.base_currency_id, quote: data.quote_currency_id, price: data.price,
    volume24hBase: decimal(data.volume_24h) ? data.volume_24h : null, observedAt,
    sourceTimestamp: null, accountConnected: false, executionEnabled: false,
    limitations: ['Public spot observation; account eligibility and competition eligibility are not verified.', 'Retrieval time is not an exchange price timestamp. Fees, spread and slippage are not modeled.'] };
}
export async function fetchCoinbaseProduct(productId, { fetcher = globalThis.fetch, now = () => new Date().toISOString(), timeoutMs = 12000 } = {}) {
  if (!coinbaseProducts.includes(productId)) throw new Error('Unsupported Coinbase research product.');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`https://api.coinbase.com/api/v3/brokerage/market/products/${productId}`, { method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error('Coinbase public market data is unavailable.');
    return normalizeCoinbaseProduct(await response.json(), productId, now());
  } finally { clearTimeout(timeout); }
}
export function simulateCoinbasePurchase(observation, quoteAmount, { now = () => Date.now() } = {}) {
  if (observation?.schema !== 'cofferhouse.coinbase.market.v1') throw new Error('A Coinbase observation is required.');
  const checked = normalizeCoinbaseProduct({ product_id: observation.productId, product_type: observation.productType, base_currency_id: observation.base, quote_currency_id: observation.quote, price: observation.price }, observation.productId, observation.observedAt);
  const age = now() - Date.parse(checked.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > 60000) throw new Error('Refresh Coinbase evidence before simulating.');
  if (!decimal(quoteAmount) || Number(quoteAmount) <= 0 || Number(quoteAmount) > 10000) throw new Error('Research amount must be greater than zero and at most 10000 quote units.');
  return { schema: 'cofferhouse.coinbase.paper-estimate.v1', productId: checked.productId, quoteAmount, quote: checked.quote, base: checked.base, estimatedBase: Number(quoteAmount) / Number(checked.price), price: checked.price, observationRetrievedAt: checked.observedAt, calculatedAt: new Date(now()).toISOString(), approximate: true, feesIncluded: false, execution: { prepared: false, signed: false, submitted: false } };
}
