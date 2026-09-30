import { sealDocument } from "./integrity.js";

export function createResearchSessionReceipt(session) {
  if (session?.schema !== "cofferhouse.agent-hub.session.v1") throw new Error("A valid Agent Hub research session is required.");
  return sealDocument({
    schema: "cofferhouse.agent-hub.session-receipt.v1",
    generatedAt: session.generatedAt,
    observedAt: session.observedAt,
    sourceAgent: "CofferHouse Agent Hub",
    dataMode: session.dataMode,
    policy: session.policy,
    stages: session.stages,
    summary: session.summary,
    outputs: session.outputs,
    execution: session.execution,
    notice: session.notice
  }, "agent-session");
}
