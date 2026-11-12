import { researchCapabilities } from "./research-contract.js";
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  return response.status(200).json(researchCapabilities({ jupiterConfigured: typeof process.env.JUPITER_API_KEY === "string" && !!process.env.JUPITER_API_KEY.trim() }));
}
