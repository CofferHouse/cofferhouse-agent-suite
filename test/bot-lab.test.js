import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateBot,filterScanner} from '../packages/agent-modules/bot-lab.js';
test('DDCA accounts for fees, six purchases and a falling-market loss',()=>{const r=simulateBot({scenario:'falling'});assert.equal(r.orders.length,6);assert.ok(Math.abs(r.cash)<1e-8);assert.ok(Math.abs(r.fees-2)<1e-8);assert.ok(r.pnl<0);});
test('grid preserves unspent cash and includes open losses',()=>{const r=simulateBot({kind:'grid',scenario:'falling'});assert.equal(r.cash,750);assert.equal(r.orders.length,1);assert.ok(r.pnl<0);});
test('higher fees lower equity; flat inactive grid places no orders',()=>{assert.ok(simulateBot({feeBps:100}).equity<simulateBot({feeBps:0}).equity);assert.equal(simulateBot({kind:'grid',scenario:'rising'}).orders.length,0);});
test('invalid numeric input is rejected',()=>{for(const capital of [NaN,-1,100001])assert.throws(()=>simulateBot({capital}),RangeError);});
test('scanner filters examples without claiming live evidence',()=>{assert.equal(filterScanner('Base',100000).length,0);assert.equal(filterScanner('Arc',100000).length,1);});
