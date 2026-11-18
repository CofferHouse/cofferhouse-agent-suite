import { compareMeteoraPositionReceipts } from "../../packages/agent-modules/meteora-position-comparison.js";
// Caller-supplied receipts only: no upstream reads, storage or registration.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const input = request.body;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["before", "after"].includes(key))) throw Error("INVALID_RECEIPT");
    return response.status(200).json({ ok: true, comparison: compareMeteoraPositionReceipts(input.before, input.after) });
  } catch (error) {
    const allowed = ["INVALID_RECEIPT", "INVALID_OBSERVATION", "IDENTITY_UNCONFIRMED", "POSITION_MISMATCH", "OBSERVATIONS_NOT_ORDERED"];
    return response.status(400).json({ ok: false, error: allowed.includes(error?.message) ? error.message : "INVALID_RECEIPT" });
  }
}
