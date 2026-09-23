const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  const token = String(request.query?.token ?? "").trim();
  if (!ADDRESS.test(token)) return response.status(400).json({ error: "A valid EVM token contract address is required." });
  try {
    const upstream = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, { headers: { Accept: "application/json" } });
    if (!upstream.ok) throw new Error(`DEX provider returned ${upstream.status}.`);
    const payload = await upstream.json();
    const pools = (payload.pairs ?? []).filter((pair) => ["arc", "5042"].includes(String(pair.chainId).toLowerCase()));
    return response.status(200).json({ schema: "cofferhouse.dex.provider-response.v1", token: token.toLowerCase(), provider: "DEX Screener", pools });
  } catch (error) {
    return response.status(502).json({ error: error.message ?? "DEX provider unavailable." });
  }
}
