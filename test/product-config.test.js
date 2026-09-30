import test from "node:test";
import assert from "node:assert/strict";
import { defaultProductLinks, productLinks } from "../packages/product-config/index.js";

test("CofferHouse product routes connect the House, Agent Room and repository", () => {
  assert.deepEqual(productLinks(), defaultProductLinks);
});

test("deployment can replace product routes without changing application code", () => {
  const links = productLinks({ VITE_HOUSE_URL: "https://house.example", VITE_HOLDER_CENTER_URL: "https://agents.example/#holders", VITE_AGENT_SUITE_URL: "https://agents.example/#agents", VITE_REPOSITORY_URL: "https://github.com/example/repo" });
  assert.equal(links.house, "https://house.example/");
  assert.equal(links.agentSuite, "https://agents.example/#agents");
  assert.equal(links.holderCenter, "https://agents.example/#holders");
});

test("unsafe public route overrides fail closed", () => {
  assert.equal(productLinks({ VITE_HOUSE_URL: "javascript:alert(1)" }).house, defaultProductLinks.house);
});
