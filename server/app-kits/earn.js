import { EarnKit } from "@circle-fin/earn-kit";

const kit = new EarnKit({ disableErrorReporting: true });

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, error: "Method not allowed" });
  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  try {
    const result = await kit.exploreVaults({
      chain: "Arc",
      sortBy: "apy",
      page: 1,
      config: process.env.CIRCLE_API_KEY ? { apiKey: process.env.CIRCLE_API_KEY } : undefined
    });
    return response.status(200).json({
      ok: true,
      source: "Circle Arc Earn Kit",
      chain: "Arc",
      observedAt: new Date().toISOString(),
      pagination: result.pagination,
      vaults: result.vaults
    });
  } catch (error) {
    return response.status(502).json({ ok: false, source: "Circle Arc Earn Kit", error: error?.message ?? "Earn Kit is unavailable" });
  }
}
