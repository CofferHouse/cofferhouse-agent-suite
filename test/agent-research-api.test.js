import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import router from "../api/index.js";
import capabilitiesHandler from "../server/agent/capabilities.js";
import openapiHandler from "../server/agent/openapi.js";
import scenarioHandler from "../server/strategy/liquidity-scenario.js";
import { researchCapabilities, researchOpenApi } from "../server/agent/research-contract.js";
import { evaluateLiquidityScenario } from "../packages/agent-modules/liquidity-scenario.js";

const res = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(value) { this.body=value; return this; } });
const assumptions = { capitalUsd:1000, principalUsd:990, positionFeesUsd:25, costsUsd:5, holdingValueUsd:1000, stressPrincipalUsd:900, feeHaircutPct:50, minProfitUsd:10, maxStressLossPct:5, horizonDays:7 };

test("agent catalog reports configuration rather than upstream health and exposes only research", () => {
  const missing = researchCapabilities({ now:()=>new Date("2026-11-12T12:00:00Z") });
  const ready = researchCapabilities({jupiterConfigured:true});
  assert.equal(missing.checkedAt,"2026-11-12T12:00:00.000Z");
  assert.equal(missing.capabilities.length,5);
  assert.equal(missing.capabilities.find(c=>c.id==="discoverJupiterLendTokens").readiness,"SETUP_REQUIRED");
  assert.equal(ready.capabilities.find(c=>c.id==="discoverJupiterLendTokens").readiness,"READY_TO_QUERY");
  assert.deepEqual(missing.integration,{http:true,mcp:false,paidAccess:false,scheduledPositionMonitoring:false});
  assert.equal(missing.execution.enabled,false);
  for(const capability of missing.capabilities) {
    assert.equal(researchOpenApi.paths[capability.path][capability.method.toLowerCase()].operationId,capability.id);
    assert.match(capability.readinessScope,/does not test upstream/);
    assert.equal(capability.authentication,"none");
    assert.doesNotMatch(capability.path,/guardian|onramp|budget|alerts|quote|agent\/run/);
  }
  assert.match(missing.capabilities.find(c=>c.id==="inspectMeteoraPosition").inputPrivacy,/sent to Meteora/);
});

test("OpenAPI references resolve, operation IDs are unique and write privileges are absent", () => {
  const ids=[];
  function walk(value) {
    if(!value || typeof value!=="object") return;
    if(value.$ref) {
      assert.ok(value.$ref.startsWith("#/"));
      const target=value.$ref.slice(2).split("/").reduce((part,key)=>part?.[key],researchOpenApi);
      assert.ok(target,`Unresolved reference ${value.$ref}`);
    }
    Object.values(value).forEach(walk);
  }
  walk(researchOpenApi);
  for(const methods of Object.values(researchOpenApi.paths)) for(const [method,op] of Object.entries(methods)) {
    assert.ok(["get","post"].includes(method));
    assert.equal(op["x-cofferhouse-read-only"],true);
    assert.deepEqual(op.security,[]);
    assert.ok(op.responses["200"]);assert.ok(op.responses["405"]);
    ids.push(op.operationId);
  }
  assert.equal(new Set(ids).size,5);
  assert.equal(researchOpenApi.components.schemas.PaperScenarioInput.additionalProperties,false);
  assert.equal(researchOpenApi.components.schemas.PaperScenarioInput.required.length,10);
});

test("public catalog and schema reject writes, disable shared caching and never expose keys", async () => {
  for(const handler of [capabilitiesHandler,openapiHandler]) {
    const denied=await handler({method:"POST",body:{privateKey:"never-forward"}},res());
    assert.equal(denied.code,405);
    const read=await handler({method:"GET"},res());
    assert.equal(read.code,200);assert.equal(read.headers["Cache-Control"],"no-store");
    assert.equal(JSON.stringify(read.body).includes(process.env.JUPITER_API_KEY || "never-forward"),false);
  }
});

test("paper endpoint reuses Holder Center economics without counting fees twice or authorizing execution", async () => {
  const response=await scenarioHandler({method:"POST",body:assumptions},res());
  assert.equal(response.code,200);
  assert.equal(response.headers["Cache-Control"],"no-store");
  assert.deepEqual(response.body.scenario,evaluateLiquidityScenario(assumptions));
  const scenario=response.body.scenario;
  assert.equal(scenario.netPnlUsd,10);assert.equal(scenario.versusHoldingUsd,10);
  assert.equal(scenario.stressPnlUsd,-92.5);assert.equal(scenario.requiredPositionFeesUsd,25);
  assert.deepEqual(scenario.blockers,["STRESS_LOSS_ABOVE_LIMIT"]);
  assert.equal(scenario.execution.enabled,false);
  assert.equal(scenario.decision,"OUTSIDE_PAPER_LIMITS");
});

test("paper endpoint rejects missing, coerced, nonfinite, out-of-bounds and unexpected assumptions", async () => {
  for(const body of [undefined,null,[],"raw JSON",{}, {...assumptions,capitalUsd:0}, {...assumptions,positionFeesUsd:"25"}, {...assumptions,principalUsd:null}, {...assumptions,principalUsd:Infinity}, {...assumptions,principalUsd:-1}, {...assumptions,horizonDays:1.5}, {...assumptions,horizonDays:366}, {...assumptions,feeHaircutPct:101}, {...assumptions,maxStressLossPct:101}, {...assumptions,costsUsd:1e13}, {...assumptions,privateKey:"not-accepted"}]) {
    const response=await scenarioHandler({method:"POST",body},res());
    assert.equal(response.code,400);assert.equal(response.body.ok,false);
    assert.equal(response.body.scenario,undefined);
  }
  assert.equal((await scenarioHandler({method:"GET"},res())).code,405);
});

test("router dispatches direct and Vercel rewritten discovery and paper paths", async () => {
  for(const endpoint of ["agent/capabilities","agent/openapi","strategy/liquidity-scenario"]) {
    const method=endpoint.startsWith("strategy")?"POST":"GET";
    for(const request of [{url:`/api/${endpoint}`,method,body:assumptions},{url:`/api?endpoint=${endpoint}`,method,body:assumptions},{url:"/api",query:{endpoint},method,body:assumptions}]) {
      const response=await router(request,res());assert.equal(response.code,200,endpoint);
    }
  }
  const discovery=await readFile(new URL("../public/llms.txt",import.meta.url),"utf8");
  assert.match(discovery,/\/api\/agent\/capabilities/);assert.match(discovery,/\/api\/agent\/openapi/);
});
