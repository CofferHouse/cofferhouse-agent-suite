import { coinbaseProducts, fetchCoinbaseProduct } from '../../packages/arc-data/coinbase.js';
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ ok: false, error: 'Method not allowed' });
  const product = request.query?.product ?? new URL(request.url, 'https://cofferhouse.invalid').searchParams.get('product');
  if (!coinbaseProducts.includes(product)) return response.status(400).json({ ok: false, error: 'Unsupported Coinbase research product.' });
  try { return response.status(200).json({ ok: true, observation: await fetchCoinbaseProduct(product) }); }
  catch { return response.status(502).json({ ok: false, error: 'Coinbase market evidence is unavailable. Refresh before simulating.' }); }
}
