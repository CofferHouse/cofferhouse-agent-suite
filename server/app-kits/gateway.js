import { fetchGatewayObservation } from "../../packages/arc-data/gateway.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  const depositor = request.query?.depositor ?? new URL(request.url, "https://cofferhouse.invalid").searchParams.get("depositor");
  if (depositor !== null && (typeof depositor !== "string" || !/^0x[0-9a-f]{40}$/i.test(depositor))) return response.status(400).json({ ok: false, error: "A valid EVM depositor address is required." });
  response.setHeader("Cache-Control", "no-store");
  try {
    return response.status(200).json({ ok: true, observation: await fetchGatewayObservation({ depositor }) });
  } catch {
    return response.status(502).json({ ok: false, error: "Gateway coverage is unavailable. No balances or routes are assumed." });
  }
}
