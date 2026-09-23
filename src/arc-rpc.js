const addressPattern = /^0x[a-fA-F0-9]{40}$/;

async function contractCode(address, rpcUrl, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: address, method: "eth_getCode", params: [address, "latest"] }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Arc RPC returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "Arc RPC rejected eth_getCode.");
    return typeof payload.result === "string" && !/^0x0*$/.test(payload.result);
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyArcMarketContracts(markets, rpcUrl, fetchImpl = fetch, { timeoutMs = 8_000 } = {}) {
  if (!rpcUrl || !/^https:\/\//i.test(rpcUrl)) throw new Error("A secure ARC_RPC_URL is required.");
  const addresses = [...new Set(markets.flatMap((market) => [
    market.loanAssetAddress,
    market.collateralAssetAddress,
    market.oracleAddress
  ]).filter((address) => addressPattern.test(address ?? "")))];
  if (!addresses.length) throw new Error("No valid Arc contract addresses were available for RPC verification.");

  const checks = await Promise.all(addresses.map(async (address) => [address.toLowerCase(), await contractCode(address, rpcUrl, fetchImpl, timeoutMs)]));
  const codeByAddress = new Map(checks);
  const verifiedMarkets = markets.map((market) => {
    const marketAddresses = [market.loanAssetAddress, market.collateralAssetAddress, market.oracleAddress]
      .filter((address) => addressPattern.test(address ?? ""));
    const missingCode = marketAddresses.filter((address) => !codeByAddress.get(address.toLowerCase()));
    return {
      ...market,
      rpcVerification: {
        source: "Arc JSON-RPC · eth_getCode",
        checked: marketAddresses.length,
        status: marketAddresses.length === 3 && missingCode.length === 0 ? "verified" : "incomplete",
        missingCode
      }
    };
  });
  const verified = verifiedMarkets.filter((market) => market.rpcVerification.status === "verified").length;
  return {
    markets: verifiedMarkets,
    summary: {
      configured: true,
      status: verified === verifiedMarkets.length ? "verified" : "incomplete",
      source: "Arc JSON-RPC · eth_getCode",
      contractsChecked: addresses.length,
      marketsVerified: verified,
      marketCount: verifiedMarkets.length
    }
  };
}
