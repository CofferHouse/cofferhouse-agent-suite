import test from "node:test";
import assert from "node:assert/strict";
import { agentCatalog, validateAgentCatalog } from "../src/agent-catalog.js";

test("agent hub exposes the complete implemented research suite", () => {
  const result = validateAgentCatalog();
  assert.equal(result.valid, true);
  assert.deepEqual(result.liveAgents, ["scout", "opportunity", "strategy", "action", "guardian", "automation"]);
  assert.equal(result.nextAgent, null);
});

test("agent roadmap follows the intended product sequence", () => {
  assert.deepEqual(agentCatalog.map((agent) => agent.id), [
    "scout", "opportunity", "strategy", "action", "guardian", "automation"
  ]);
  assert.ok(agentCatalog.every((agent) => agent.role && agent.output));
});
