export const agentCatalog = Object.freeze([
  Object.freeze({
    order: 1,
    id: "scout",
    name: "Scout",
    stage: "LIVE",
    tone: "live",
    role: "Observe markets and expose risk before capital moves.",
    output: "Risk reports, monitoring alerts, simulations and verifiable receipts.",
    available: true
  }),
  Object.freeze({
    order: 2,
    id: "opportunity",
    name: "Opportunity",
    stage: "LIVE",
    tone: "live",
    role: "Compare eligible markets and identify explainable opportunities.",
    output: "Ranked opportunities, sizing bounds, missing evidence and invalidation conditions.",
    available: true
  }),
  Object.freeze({
    order: 3,
    id: "strategy",
    name: "Strategy Lab",
    stage: "LIVE",
    tone: "live",
    role: "Turn approved opportunities into a personalized allocation proposal.",
    output: "Capital allocation, expected yield range, risk budget and exit conditions.",
    available: true
  }),
  Object.freeze({
    order: 4,
    id: "action",
    name: "Action Center",
    stage: "LIVE",
    tone: "live",
    role: "Separate research from an action that requires explicit authorization.",
    output: "Transaction preview, contract checks, permissions, simulation and approval request.",
    available: true
  }),
  Object.freeze({
    order: 5,
    id: "guardian",
    name: "Guardian",
    stage: "LIVE",
    tone: "live",
    role: "Monitor approved positions and detect conditions requiring attention.",
    output: "Position health, risk changes, hold, review, withdrawal or rebalance proposals.",
    available: true
  }),
  Object.freeze({
    order: 6,
    id: "automation",
    name: "Automation",
    stage: "LIVE · SANDBOX",
    tone: "live",
    role: "Manage revocable permissions for narrowly bounded execution.",
    output: "Allowlists, amount caps, expiry, emergency pause and auditable execution limits.",
    available: true
  })
]);

export function validateAgentCatalog(catalog = agentCatalog) {
  const ids = new Set(catalog.map((agent) => agent.id));
  const orders = catalog.map((agent) => agent.order);
  return {
    valid: ids.size === catalog.length
      && orders.every((order, index) => order === index + 1)
      && catalog.filter((agent) => agent.available).length >= 1
      && catalog[0]?.id === "scout",
    liveAgents: catalog.filter((agent) => agent.available).map((agent) => agent.id),
    nextAgent: catalog.find((agent) => agent.stage === "NEXT BUILD")?.id ?? null
  };
}
