import test from "node:test";
import assert from "node:assert/strict";
import { sacrificePreview, rewardStatus, membershipWeights } from "../packages/agent-modules/membership-policy.js";

test("sacrifice accepts homogeneous lower-level cards and rejects survivor, duplicates, missing ownership and mixed levels", () => {
  const cards = [{id:"1",level:2},{id:"4",level:3},{id:"5",level:0},{id:"6",level:0},{id:"7",level:0}];
  assert.equal(sacrificePreview(cards,"1",["5","6","7"]).target,3);
  for (const ids of [["1"],["5","5"],["99"],["4","5"],[]]) assert.throws(()=>sacrificePreview(cards,"1",ids));
  assert.throws(()=>sacrificePreview(cards,"5",["1"]));
  assert.throws(()=>sacrificePreview([{id:"8",level:5}],"8",["5"]));
});

test("review ends at exact timestamp, but paused and claimed rewards remain unavailable", () => {
  const epoch={availableAt:100n};
  assert.equal(rewardStatus(epoch,false,false,99),"REVIEW");
  assert.equal(rewardStatus(epoch,false,false,100),"CLAIMABLE");
  assert.equal(rewardStatus(epoch,false,true,101),"PAUSED");
  assert.equal(rewardStatus(epoch,true,false,101),"CLAIMED");
  assert.deepEqual(membershipWeights,[0,2,4,7,10,16]);
});
