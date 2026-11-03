import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, verify} from 'node:crypto';
import {readCoinbaseBalances} from '../scripts/coinbase-readonly.mjs';
const {privateKey, publicKey} = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const key = {name:'organizations/test/apiKeys/test',privateKey:privateKey.export({type:'pkcs8',format:'pem'})};
const view = {can_view:true,can_trade:false,can_transfer:false};
const json = body => ({ok:true,json:async()=>body});
test('Coinbase rejects write-capable or ambiguous keys before any balance request', async () => {
  for (const permissions of [{...view,can_trade:true},{...view,can_transfer:true},{can_view:true}]) {
    const calls=[];
    await assert.rejects(readCoinbaseBalances(key,{fetcher:async url=>{calls.push(url);return json(permissions)}}),/View only/);
    assert.deepEqual(calls,['https://api.coinbase.com/api/v3/brokerage/key_permissions']);
  }
});
test('Coinbase signs only fixed GET paths and reads all pages without rounding balances', async () => {
  let count=0;
  const result=await readCoinbaseBalances(key,{fetcher:async (url,options)=>{
    const parsed=new URL(url);
    assert.equal(parsed.hostname,'api.coinbase.com');
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    const [head,body,sig]=options.headers.Authorization.slice(7).split('.');
    const claims=JSON.parse(Buffer.from(body,'base64url'));
    assert.equal(claims.uri,`GET api.coinbase.com${parsed.pathname}`);
    assert.equal(claims.exp-claims.nbf,120);
    assert.ok(verify('sha256',Buffer.from(`${head}.${body}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')));
    if (++count===1) return json(view);
    if (count===3) assert.equal(parsed.searchParams.get('cursor'),'next');
    return json({accounts:[{currency:'BTC',available_balance:{currency:'BTC',value:'0.00000001'},hold:{currency:'BTC',value:'0'}}],has_next:count===2,cursor:'next'});
  }});
  assert.equal(result.balances.length,2);
  assert.equal(result.balances[0].available,'0.00000001');
});
test('Coinbase rejects a repeated cursor rather than returning incomplete balances', async () => {
  await assert.rejects(readCoinbaseBalances(key,{fetcher:async url=>json(url.endsWith('key_permissions')?view:{accounts:[],has_next:true,cursor:'repeat'})}),/pagination/);
});
