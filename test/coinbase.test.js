import { sealDocument } from '../packages/evidence/integrity.js';
import { verifyReceiptDocument } from '../packages/evidence/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCoinbaseProduct, normalizeCoinbaseProduct, simulateCoinbasePurchase } from '../packages/arc-data/coinbase.js';
import { coinbaseHtml } from '../packages/agent-modules/coinbase-view.js';
import handler from '../server/coinbase/market.js';
const time = '2026-11-03T00:00:00.000Z';
const data = () => ({ product_id: 'BTC-USD', product_type: 'SPOT', base_currency_id: 'BTC', quote_currency_id: 'USD', price: '80000', volume_24h: '123' });
const observation = () => normalizeCoinbaseProduct(data(), 'BTC-USD', time);
test('Coinbase research validates exact spot identity and keeps USD separate from USDC', () => {
  assert.equal(observation().quote, 'USD');
  assert.equal(observation().executionEnabled, false);
  for (const change of [{product_id:'BTC-USDC'}, {product_type:'FUTURE'}, {quote_currency_id:'USDC'}, {base_currency_id:'ETH'}]) assert.throws(() => normalizeCoinbaseProduct({...data(), ...change}, 'BTC-USD', time), /identity/);
});
test('missing or malformed price evidence cannot become zero', () => {
  for (const price of [null, '', 'NaN', '-1', '0', '1e3', 'Infinity', ' 1', 5]) assert.throws(() => normalizeCoinbaseProduct({...data(),price}, 'BTC-USD', time));
  assert.equal(normalizeCoinbaseProduct({...data(),volume_24h:null},'BTC-USD',time).volume24hBase, null);
});
test('paper estimate is bounded, approximate and cannot prepare an order', () => {
  const now = () => Date.parse(time);
  const result = simulateCoinbasePurchase(observation(), '100', {now});
  assert.equal(result.estimatedBase, 0.00125);
  assert.deepEqual(result.execution, {prepared:false,signed:false,submitted:false});
  assert.equal(result.feesIncluded, false);
  for (const amount of ['0','-1','10001','1e2','NaN',null]) assert.throws(() => simulateCoinbasePurchase(observation(), amount, {now}));
  for (const offset of [-1,60001]) assert.throws(() => simulateCoinbasePurchase(observation(),'100',{now:()=>now()+offset}), /Refresh/);
});
test('fixed-origin GET adapter rejects redirects, upstream failures and unknown products', async () => {
  let calls = 0;
  const result = await fetchCoinbaseProduct('BTC-USD', {now:()=>time, fetcher:async (url, options)=>{
    calls++; assert.equal(url,'https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD');
    assert.equal(options.method,'GET'); assert.equal(options.redirect,'error'); assert.equal(options.headers.Authorization,undefined);
    return {ok:true,json:async()=>data()};
  }});
  assert.equal(result.price,'80000'); assert.equal(calls,1);
  await assert.rejects(fetchCoinbaseProduct('../orders', {fetcher:()=>{throw Error('must not fetch')}}), /Unsupported/);
  for (const status of [401,429,503]) await assert.rejects(fetchCoinbaseProduct('BTC-USD',{fetcher:async()=>({ok:false,status})}), /unavailable/);
  await assert.rejects(fetchCoinbaseProduct('BTC-USD',{timeoutMs:1, fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout'))))}), /timeout/);
});
test('public endpoint refuses writes and unapproved products', async () => {
  const response = {setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
  await handler({method:'POST'},response); assert.equal(response.code,405);
  await handler({method:'GET',url:'/api/coinbase/market?product=BTC-PERP'},response); assert.equal(response.code,400);
});
test('Coinbase panel escapes provider evidence and presents explicit research boundaries', () => {
  const html = coinbaseHtml({mode:'ready',observation:{...observation(),price:'<img src=x>'},product:'BTC-USD'});
  assert.equal(html.includes('<img'),false);
  assert.match(html,/No Coinbase account is connected/);
  assert.match(html,/No order is created/);
});

test('Coinbase evidence is registered and detects modified paper estimates', () => {
  const receipt = sealDocument({schema:'cofferhouse.coinbase.research-receipt.v1',observation:observation(),preview:simulateCoinbasePurchase(observation(),'100',{now:()=>Date.parse(time)})},'coinbase-research');
  assert.equal(verifyReceiptDocument(receipt).valid,true);
  receipt.preview.quoteAmount = '1000';
  assert.equal(verifyReceiptDocument(receipt).valid,false);
});
