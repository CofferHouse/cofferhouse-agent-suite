import test from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/retry.js";

test("recovers from retryable source failures", async () => {
  let calls = 0;
  const delays = [];
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error("temporary"), { retryable: true });
    return "recovered";
  }, { attempts: 3, delayMs: 10, sleep: async (delay) => delays.push(delay) });
  assert.equal(result, "recovered");
  assert.deepEqual(delays, [10, 20]);
});

test("does not retry permanent validation failures", async () => {
  let calls = 0;
  await assert.rejects(() => withRetry(async () => {
    calls += 1;
    throw Object.assign(new Error("invalid"), { retryable: false });
  }, { sleep: async () => {} }), /invalid/);
  assert.equal(calls, 1);
});
