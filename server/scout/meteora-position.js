import { fetchMeteoraPosition, validMeteoraPositionTarget } from "../../packages/arc-data/meteora-position.js";

export function createMeteoraPositionHandler({ read = fetchMeteoraPosition } = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
    const target = { pool: request.body?.pool, user: request.body?.user, position: request.body?.position };
    if (!validMeteoraPositionTarget(target)) return response.status(400).json({ ok: false, error: "Valid pool, wallet and position public keys are required" });
    try { return response.status(200).json({ ok: true, ...await read(target) }); }
    catch { return response.status(502).json({ ok: false, error: "Position observation unavailable" }); }
  };
}
export default createMeteoraPositionHandler();
