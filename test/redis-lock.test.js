import test from "node:test";
import assert from "node:assert/strict";
import { compareAndSetJson, deleteJsonIfValue, setJsonIfAbsent, getJson } from "../server/_redis.js";

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


test("budget compare-and-set uses one atomic Redis script and preserves exact JSON", async () => {
  await withRedisMock([1, 0], async commands => {
    assert.equal(await compareAndSetJson("budget", null, { reservedUnits: "9007199254740993" }), true);
    assert.equal(await compareAndSetJson("budget", { version: 1 }, { version: 2 }), false);
    assert.deepEqual(commands[0].slice(2), ["1", "budget", "absent", "", '{"reservedUnits":"9007199254740993"}']);
    assert.equal(commands[1][4], "present");
    assert.equal(commands[1][5], '{"version":1}');
    assert.match(commands[0][1], /redis.call\('get'/);
    assert.match(commands[0][1], /redis.call\('set'/);
  });
});

test('Redis requests have a three-second abort deadline, including response-body reads',async()=>{
  for(const phase of ['fetch','body']){
    await withRedisMock([],async()=>{
      const originalTimeout=AbortSignal.timeout;
      let calls=0;
      // Accelerate the actual deadline for the test without changing production's 3000ms.
      AbortSignal.timeout=ms=>{assert.equal(ms,3000);return originalTimeout.call(AbortSignal,5);};
      globalThis.fetch=async(_url,{signal})=>{
        calls++;assert.ok(signal instanceof AbortSignal);
        const wait=()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
        if(phase==='fetch')return wait();
        return {ok:true,json:wait};
      };
      const keepAlive=setTimeout(()=>{},1000); // AbortSignal's timer itself is unref'ed.
      try {
        const request=phase==='fetch'?compareAndSetJson('test-key',null,{revision:1}):getJson('test-key');
        await assert.rejects(request,error=>error.name==='TimeoutError');
        assert.equal(calls,1); // Ambiguous writes must not be retried by the client.
      } finally {clearTimeout(keepAlive);AbortSignal.timeout=originalTimeout;}
    });
  }
});
