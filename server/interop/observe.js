import { fetchArcCctpObservation } from "../../packages/agent-modules/index.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "public, max-age=20, s-maxage=20, stale-while-revalidate=40");
  const rpcUrl = process.env.ARC_RPC_URL;
  if (!rpcUrl || !/^https:\/\//i.test(rpcUrl)) return response.status(503).json({ ok: false, configured: false, error: "Arc RPC observation is not configured." });
  try {
    const observation = await fetchArcCctpObservation(rpcUrl, { blocks: request.query?.blocks });
    return response.status(200).json({ ok: true, configured: true, observation });
  } catch (error) {
    return response.status(502).json({ ok: false, configured: true, error: error.name === "AbortError" ? "Arc RPC observation timed out." : error.message ?? "Arc RPC observation failed safely." });
  }
}
