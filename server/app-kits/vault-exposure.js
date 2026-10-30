import { fetchVaultExposure } from "../../packages/arc-data/vault-exposure.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  const vault = request.query?.vault ?? new URL(request.url, "https://cofferhouse.invalid").searchParams.get("vault");
  if (typeof vault !== "string" || !/^0x[0-9a-f]{40}$/i.test(vault)) return response.status(400).json({ ok: false, error: "A valid vault address is required." });
  response.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
  try {
    return response.status(200).json({ ok: true, observation: await fetchVaultExposure(vault) });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({ ok: false, error: error.name === "AbortError" ? "Vault observation timed out." : "Vault exposure is unavailable or incomplete in the Morpho Arc index." });
  }
}
