const address = value => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
const equal = (a, b) => address(a) && address(b) && a.toLowerCase() === b.toLowerCase();

export function validateRewardCatalog(catalog, expected) {
  if (catalog.schema !== "cofferhouse-reward-catalog-v1" || String(catalog.chainId) !== String(expected.chainId) || !equal(catalog.membership, expected.membership) || !equal(catalog.distributor, expected.rewards)) throw Error("Reward catalog domain mismatch.");
  if (!Array.isArray(catalog.periods) || catalog.periods.length > 100) throw Error("Invalid reward catalog size.");
  const seen = new Set();
  const periods = catalog.periods.map(item => {
    if (typeof item.epoch !== "string" || !/^[1-9][0-9]*$/.test(item.epoch) || BigInt(item.epoch) >= 2n ** 256n || seen.has(item.epoch)) throw Error("Invalid or duplicate reward period.");
    seen.add(item.epoch);
    if (!address(item.token) || typeof item.symbol !== "string" || !/^[A-Za-z0-9 ._-]{1,24}$/.test(item.symbol)) throw Error("Invalid reward asset label.");
    // Same-origin static manifests only; no credentials, arbitrary hosts or traversal.
    if (typeof item.manifest !== "string" || !/^\/rewards\/[A-Za-z0-9_./-]+\.json$/.test(item.manifest) || item.manifest.split("/").slice(1).some(part => ["", ".", ".."].includes(part))) throw Error("Invalid reward manifest path.");
    return { epoch: item.epoch, token: item.token, symbol: item.symbol, manifest: item.manifest };
  });
  return periods.sort((a, b) => BigInt(a.epoch) > BigInt(b.epoch) ? -1 : 1);
}

export function selectRewardPeriod(periods, previous) {
  return periods.find(item => item.epoch === previous) ?? periods[0] ?? null;
}

export function validateRewardBinding(manifest, selected, expected) {
  const d = manifest.domain;
  if (!d || String(d.chainId) !== String(expected.chainId) || !equal(d.membership, expected.membership) || !equal(d.distributor, expected.rewards) || !equal(d.token, selected.token) || String(d.epoch) !== selected.epoch) throw Error("Reward proof domain mismatch.");
  if (manifest.schema !== "cofferhouse-rewards-v1" || manifest.pointScale !== 2 || !Array.isArray(manifest.weights) || manifest.weights.map(String).join(",") !== "0,2,4,7,10,16" || !Array.isArray(manifest.claims)) throw Error("Unsupported reward manifest policy.");
}
