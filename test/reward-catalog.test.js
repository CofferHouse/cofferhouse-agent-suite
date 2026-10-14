import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {validateRewardCatalog, selectRewardPeriod, validateRewardBinding} from "../packages/agent-modules/reward-catalog.js";
const addr = n => "0x" + String(n).padStart(40, "0");
const expected = {chainId: 5042002, membership: addr(1), rewards: addr(2)};
const period = epoch => ({epoch,token:addr(3),symbol:"TESTCOFFERS",manifest:`/rewards/epoch-${epoch}.json`});
const catalog = {schema:"cofferhouse-reward-catalog-v1",chainId:"5042002",membership:addr(1),distributor:addr(2),periods:[period("1"),period("3"),period("2")]};
test("sorts periods by integer epoch and preserves a selected historic period", () => {
  const items=validateRewardCatalog(catalog,expected);
  assert.deepEqual(items.map(x=>x.epoch),["3","2","1"]);
  assert.equal(selectRewardPeriod(items,"1").epoch,"1");
  assert.equal(selectRewardPeriod(items,"9").epoch,"3");
  assert.equal(selectRewardPeriod([],null),null);
});
test("rejects catalogs for another chain, collection or distributor", () => {
  for(const patch of [{chainId:"5042"},{membership:addr(4)},{distributor:addr(4)},{schema:"other"}]) assert.throws(()=>validateRewardCatalog({...catalog,...patch},expected));
});
test("rejects duplicate, malformed and oversized epochs", () => {
  for(const periods of [[period("1"),period("1")],[period("01")],[period("0")],[period(String(2n**256n))],Array.from({length:101},(_,i)=>period(String(i+1)))]) assert.throws(()=>validateRewardCatalog({...catalog,periods},expected));
});
test("rejects external, traversing and executable manifest paths", () => {
  for(const manifest of ["https://example.com/x.json","//example.com/x.json","/rewards/../x.json","/rewards/%2e%2e/x.json","/rewards/x.json?redirect=1","javascript:alert(1)","/rewards//x.json"]) assert.throws(()=>validateRewardCatalog({...catalog,periods:[{...period("1"),manifest}]},expected));
});
test("requires nonzero reward token and plain asset label", () => {
  for(const patch of [{token:addr(0)},{symbol:"<img onerror=x>"}]) assert.throws(()=>validateRewardCatalog({...catalog,periods:[{...period("1"),...patch}]},expected));
});
test("binds the selected period to the verified network and asset", () => {
  const selected=period("2");
  const manifest={schema:"cofferhouse-rewards-v1",pointScale:2,weights:["0","2","4","7","10","16"],claims:[],domain:{chainId:"5042002",membership:addr(1),distributor:addr(2),token:addr(3),epoch:"2"}};
  assert.doesNotThrow(()=>validateRewardBinding(manifest,selected,expected));
  for(const patch of [{epoch:"1"},{token:addr(4)},{chainId:"5042"},{membership:addr(4)},{distributor:addr(4)}]) assert.throws(()=>validateRewardBinding({...manifest,domain:{...manifest.domain,...patch}},selected,expected));
  for(const patch of [{pointScale:1},{weights:[0,1,2,3,4,5]},{claims:null},{schema:"other"}]) assert.throws(()=>validateRewardBinding({...manifest,...patch},selected,expected));
});
test("the shipped catalog binds to the actual rehearsal manifest", () => {
  const actual=JSON.parse(fs.readFileSync(new URL("../public/rewards/testnet-catalog.json",import.meta.url),"utf8"));
  const manifest=JSON.parse(fs.readFileSync(new URL("../public/rewards/testnet-epoch-1.json",import.meta.url),"utf8"));
  const config={chainId:5042002,membership:manifest.domain.membership,rewards:manifest.domain.distributor};
  const entries=validateRewardCatalog(actual,config);
  assert.equal(entries.length,1);
  assert.doesNotThrow(()=>validateRewardBinding(manifest,entries[0],config));
});
