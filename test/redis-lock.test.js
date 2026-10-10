import test from "node:test";
import assert from "node:assert/strict";
import { deleteJsonIfValue, setJsonIfAbsent } from "../server/_redis.js";

async function withRedisMock(results, callback) {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const commands = [];
  process.env.UPSTASH_REDIS_REST_URL = "https://cofferhouse-test.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-long-enough-for-tests";
  globalThis.fetch = async (_url, options) => {
    commands.push(JSON.parse(options.body));
    return { ok: true, async json() { return { result: results.shift() }; } };
  };
  try { return await callback(commands); }
  finally {
    globalThis.fetch = previousFetch;
    if (previousUrl) process.env.UPSTASH_REDIS_REST_URL = previousUrl; else delete process.env.UPSTASH_REDIS_REST_URL;
    if (previousToken) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken; else delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
}

test("durable run lock is atomic and expires automatically", async () => {
  await withRedisMock(["OK", null], async (commands) => {
    assert.equal(await setJsonIfAbsent("lock", { runId: "one" }, 90), true);
    assert.equal(await setJsonIfAbsent("lock", { runId: "two" }, 90), false);
    assert.deepEqual(commands[0], ["SET", "lock", '{"runId":"one"}', "NX", "EX", "90"]);
  });
});

test("run lock release only deletes the lock owned by that run", async () => {
  await withRedisMock([1, 0], async (commands) => {
    assert.equal(await deleteJsonIfValue("lock", { runId: "one" }), true);
    assert.equal(await deleteJsonIfValue("lock", { runId: "other" }), false);
    assert.equal(commands[0][0], "EVAL");
    assert.equal(commands[0][2], "1");
  });
});
