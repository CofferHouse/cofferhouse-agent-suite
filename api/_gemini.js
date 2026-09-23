import { createIncidentPrompt, deterministicIncidentAnalysis, validateIncidentAnalysis } from "../src/agent-intelligence.js";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const responseSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "A concise explanation grounded only in supplied evidence." },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    recommended_action: { type: "string", enum: ["MONITOR", "HUMAN_REVIEW", "PAUSE_AUTOMATION"] },
    evidence: { type: "array", items: { type: "string" }, description: "Evidence copied or faithfully paraphrased from the supplied cycle." },
    confidence_note: { type: "string", description: "State important missing context or uncertainty." }
  },
  required: ["summary", "priority", "recommended_action", "evidence", "confidence_note"]
};

function outputText(payload) {
  for (const step of payload.steps ?? []) {
    if (step.type !== "model_output") continue;
    const block = step.content?.find((item) => item.type === "text");
    if (block?.text) return block.text;
  }
  throw new Error("Gemini returned no structured text output.");
}

export async function analyzeAgentCycle(cycle) {
  if (!geminiConfigured() || !["REVIEW", "ESCALATE"].includes(cycle.decision.action)) return deterministicIncidentAnalysis(cycle);
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        input: createIncidentPrompt(cycle),
        store: false,
        response_format: { type: "text", mime_type: "application/json", schema: responseSchema }
      })
    });
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`);
    const payload = await response.json();
    return validateIncidentAnalysis(JSON.parse(outputText(payload)));
  } catch (error) {
    return { ...deterministicIncidentAnalysis(cycle), modelError: error.message };
  }
}
