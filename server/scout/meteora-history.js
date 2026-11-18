import { fetchMeteoraHistory } from "../../packages/arc-data/meteora-history.js";
import { validMeteoraPositionTarget } from "../../packages/arc-data/meteora-position.js";
export function createMeteoraHistoryHandler({ read = fetchMeteoraHistory } = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
    const target = { pool: request.body?.pool, user: request.body?.user, position: request.body?.position };
    if (!validMeteoraPositionTarget(target)) return response.status(400).json({ ok: false, error: "Valid public pool, wallet and position keys are required" });
    try { return response.status(200).json({ ok: true, history: await read(target) }); }
    catch { return response.status(502).json({ ok: false, error: "Position history unavailable" }); }
  };
}
export default createMeteoraHistoryHandler();
