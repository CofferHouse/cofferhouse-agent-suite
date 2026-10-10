import { durableStoreConfigured, getJson } from "../../_redis.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (!durableStoreConfigured()) return response.status(503).json({ ok: false, error: "Durable store is not configured." });
  const token = String(request.query?.token ?? "");
  if (!/^[a-f0-9]{32}$/i.test(token)) return response.status(400).json({ ok: false, error: "A valid private status token is required." });
  const state = await getJson(`cofferhouse:alerts:telegram:status:${token}`);
  return response.status(200).json({ ok: true, status: state?.status ?? "EXPIRED", linkedAt: state?.linkedAt ?? null });
}
