import test from "node:test";
import assert from "node:assert/strict";
import { deploymentView } from "../packages/shared/deployment-view.js";
import { buildMissionControl } from "../packages/agent-core/index.js";

test("anonymous runtime summary remains operational without operator diagnostic lists", () => {
  const summary = { status: "OPERATIONAL", ageMinutes: 3, recovery: { state: "IDLE" } };
  const view = deploymentView(summary);
  assert.equal(view.required.map(item => item.label).join(""), "");
  assert.equal(view.recommended.map(item => item.label).join(""), "");
  const mission = buildMissionControl({ deployment: view });
  assert.equal(mission.indicators.find(item => item.id === "runtime").value, "OPERATIONAL");
  assert.equal(mission.indicators.find(item => item.id === "runtime").detail, "3 min since run");
  assert.equal("required" in summary, false);
});

test("operator diagnostics survive normalization and absent deployments stay absent", () => {
  const detailed = { status: "SETUP_REQUIRED", required: [{ label: "Durable memory", ready: false }], recommended: [] };
  assert.deepEqual(deploymentView(detailed), detailed);
  assert.equal(deploymentView(null), null);
  assert.equal(deploymentView({}), null);
});
