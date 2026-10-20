import test from 'node:test';
import assert from 'node:assert/strict';
import { BorrowKit } from '@circle-fin/borrow-kit';

test('locked Borrow Kit exposes the position reader required by Guardian',()=>{
  const kit = new BorrowKit({disableErrorReporting:true});
  assert.equal(typeof kit.getPosition,'function');
});
