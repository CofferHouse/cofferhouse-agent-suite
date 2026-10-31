const ADDRESS = /^0x[0-9a-f]{40}$/i;
const ID = /^0x[0-9a-f]{64}$/i;
const uint = value => typeof value === "string" && /^(0|[1-9][0-9]{0,77})$/.test(value) ? value : null;
const address = value => typeof value === "string" && ADDRESS.test(value) ? value.toLowerCase() : null;
const ratio = (amount, total) => amount !== null && total !== null && BigInt(total) > 0n
  ? Number(BigInt(amount) * 10_000n / BigInt(total)) / 100 : null;

export function normalizeVaultExposure({ config, state, allocations }, { vaultAddress, version, observedAt }) {
  const expected = address(vaultAddress);
  if (!expected || ![1, 2].includes(version)) throw new Error("Invalid vault identity or version.");
  for (const [kind, item] of Object.entries({ config, state, allocations })) {
    if (item?.chain_id !== 5042 || address(item.address ?? item.vault_address) !== expected) {
      throw new Error(`Morpho ${kind} identity does not match the requested Arc vault.`);
    }
  }
  if (!String(config.version).startsWith(`${version}.`)) throw new Error("Morpho vault version mismatch.");
  const blocks = [config, state, allocations].map(item => uint(item.last_indexed_block));
  const aligned = blocks.every(block => block !== null && block === blocks[0]);
  const warnings = ["Indexed API evidence; not an independent onchain verification."];
  if (!aligned) warnings.push("Source blocks differ or are missing; totals and concentration are not reconciled.");
  const list = allocations.allocations;
  if (!Array.isArray(list) || list.length > 500) throw new Error("Morpho allocation list is missing or exceeds the research limit.");
  const total = uint(state.total_assets);
  const liquidity = uint(state.withdrawable_assets);
  const normalizeCap = cap => ({
      type: String(cap.cap_type ?? "unknown"), id: ID.test(cap.cap_id ?? "") ? cap.cap_id : null,
      marketId: ID.test(cap.market_id ?? "") ? cap.market_id : null,
      allocatedUnits: uint(cap.allocated_assets), absoluteCapUnits: uint(cap.absolute_cap),
      relativeCapWad: uint(cap.relative_cap_wad),
      exceedsAbsoluteCap: uint(cap.allocated_assets) !== null && uint(cap.absolute_cap) !== null ? BigInt(cap.allocated_assets) > BigInt(cap.absolute_cap) : null,
      exceedsRelativeCap: aligned && total !== null && BigInt(total) > 0n && uint(cap.allocated_assets) !== null && uint(cap.relative_cap_wad) !== null
        ? BigInt(cap.allocated_assets) * 10n ** 18n > BigInt(total) * BigInt(cap.relative_cap_wad) : null
  });
  const unscopedCaps = version === 2 && Array.isArray(allocations.unscoped_caps) ? allocations.unscoped_caps.map(normalizeCap) : [];
  const seen = new Set();
  const positions = list.map(item => {
    const key = version === 1 ? item.market_id : address(item.adapter_address);
    if (!(version === 1 ? ID.test(key ?? "") : key) || seen.has(key.toLowerCase())) throw new Error("Invalid or duplicated allocation identity.");
    seen.add(key.toLowerCase());
    // V2 risk caps overlap. Only the adapter-level cap is a top-level balance.
    const caps = version === 2 && Array.isArray(item.caps) ? item.caps : [];
    const adapterCaps = caps.filter(cap => cap.cap_type === "adapter");
    const amount = version === 1 ? uint(item.supply_assets) : adapterCaps.length === 1 ? uint(adapterCaps[0].allocated_assets) : null;
    const absoluteCap = version === 1 ? uint(item.supply_cap) : adapterCaps.length === 1 ? uint(adapterCaps[0].absolute_cap) : null;
    const riskCaps = caps.map(normalizeCap);
    return {
      kind: version === 1 ? "MARKET" : "ADAPTER", id: key.toLowerCase(),
      allocatedUnits: amount, absoluteCapUnits: absoluteCap,
      sharePct: aligned ? ratio(amount, total) : null, riskCaps,
      underlyingVault: address(item.target?.vault_address),
      exceedsAbsoluteCap: amount !== null && absoluteCap !== null ? BigInt(amount) > BigInt(absoluteCap) : null
    };
  });
  const knownAmounts = positions.every(item => item.allocatedUnits !== null);
  const allocated = knownAmounts ? positions.reduce((sum, item) => sum + BigInt(item.allocatedUnits), 0n).toString() : null;
  const idle = version === 2 ? uint(state.idle_assets) : null;
  // V1 idle is not inferred from unused borrowing capacity or a residual.
  const reconciled = aligned && total !== null && allocated !== null
    ? version === 2 && idle !== null ? BigInt(allocated) + BigInt(idle) === BigInt(total) : version === 1 ? BigInt(allocated) === BigInt(total) : false
    : false;
  if (!reconciled) warnings.push("Allocation totals are incomplete or do not reconcile with total assets.");
  if (version === 2) warnings.push("Adapter exposure is one level deep; nested vaults and overlapping risk caps are not additional balances.");
  if (unscopedCaps.some(cap => cap.exceedsAbsoluteCap || cap.exceedsRelativeCap) || positions.some(item => item.exceedsAbsoluteCap || item.riskCaps.some(cap => cap.exceedsAbsoluteCap || cap.exceedsRelativeCap))) warnings.push("Observed exposure exceeds a reported cap; review allocation drift.");
  const decimals = config.asset?.decimals;
  const evidenceComplete = address(config.asset?.address) !== null && Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 && liquidity !== null && address(config.owner) !== null && address(config.curator) !== null;
  if (!evidenceComplete) warnings.push("Asset, role or withdrawal evidence is incomplete.");
  return {
    schema: "cofferhouse.morpho.vault-exposure.v1", source: "Morpho public REST API",
    chainId: 5042, vaultAddress: expected, version, observedAt,
    sourceBlocks: { config: blocks[0], state: blocks[1], allocations: blocks[2] },
    aligned, reconciled, status: aligned && reconciled && evidenceComplete ? "INDEXED_OBSERVATION" : "PARTIAL_EVIDENCE",
    asset: { address: address(config.asset?.address), symbol: String(config.asset?.symbol ?? "Unknown"), decimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : null },
    roles: { owner: address(config.owner), curator: address(config.curator), guardian: version === 1 ? address(config.guardian) : null, allocators: null },
    totalAssetsUnits: total, withdrawableAssetsUnits: liquidity, idleAssetsUnits: idle,
    allocatedAssetsUnits: aligned ? allocated : null,
    withdrawalCoveragePct: aligned ? ratio(liquidity, total) : null,
    largestPositionPct: aligned && reconciled && positions.length ? Math.max(...positions.map(item => item.sharePct ?? 0)) : null,
    positions, unscopedCaps, warnings,
    limitations: ["Allocator lists, collateral and oracle look-through are not supplied by this adapter.", "No market allocation is added to portfolio capital; this is a breakdown of existing vault exposure.", "No deposit, withdrawal, signature or transaction is prepared."]
  };
}

export async function fetchVaultExposure(vaultAddress, { fetcher = globalThis.fetch, now = () => new Date().toISOString() } = {}) {
  const vault = address(vaultAddress);
  if (!vault) throw new Error("A valid vault address is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const read = async (version, suffix = "") => {
    const apiVersion = version === 2 && suffix === "/state" ? "v1" : "v0";
    const result = await fetcher(`https://api.morpho.org/${apiVersion}/vaults-v${version}/5042:${vault}${suffix}`, { headers: { Accept: "application/json" }, signal: controller.signal, redirect: "error" });
    if (result.status === 404) return null;
    if (!result.ok) throw new Error(`Morpho exposure service unavailable (${result.status}).`);
    const payload = await result.json();
    if (!payload?.data || typeof payload.data !== "object") throw new Error("Morpho exposure response is incomplete.");
    return payload.data;
  };
  try {
    const configurations = await Promise.all([read(1), read(2)]);
    const matches = configurations.map((config, index) => ({ config, version: index + 1 })).filter(item => item.config !== null);
    if (matches.length !== 1) throw new Error("Arc vault version is unavailable or ambiguous in the Morpho index.");
    const { config, version } = matches[0];
    const [state, allocations] = await Promise.all([read(version, "/state"), read(version, "/allocations")]);
    return normalizeVaultExposure({ config, state, allocations }, { vaultAddress: vault, version, observedAt: now() });
  } finally { clearTimeout(timeout); }
}

export function compareVaultExposure(previous, current) {
  if (!previous || !current || previous.vaultAddress !== current.vaultAddress || previous.chainId !== current.chainId || previous.version !== current.version || !previous.asset?.address || previous.asset.address !== current.asset?.address || previous.asset.decimals !== current.asset.decimals) return { status: "NOT_COMPARABLE", changes: [] };
  if (previous.status !== "INDEXED_OBSERVATION" || current.status !== "INDEXED_OBSERVATION" || !previous.aligned || !current.aligned || !previous.reconciled || !current.reconciled || !uint(previous.sourceBlocks?.state) || !uint(current.sourceBlocks?.state) || BigInt(current.sourceBlocks.state) <= BigInt(previous.sourceBlocks.state)) return { status: "NOT_COMPARABLE", changes: [] };
  const changes = [];
  for (const role of ["owner", "curator", "guardian"]) {
    if (previous.roles[role] && current.roles[role] && previous.roles[role] !== current.roles[role]) changes.push({ kind: "ROLE_CHANGED", role, before: previous.roles[role], after: current.roles[role] });
  }
  if (previous.withdrawalCoveragePct !== null && current.withdrawalCoveragePct !== null && current.withdrawalCoveragePct < previous.withdrawalCoveragePct) changes.push({ kind: "LIQUIDITY_DECREASED", before: previous.withdrawalCoveragePct, after: current.withdrawalCoveragePct });
  if (previous.largestPositionPct !== null && current.largestPositionPct !== null && current.largestPositionPct > previous.largestPositionPct) changes.push({ kind: "CONCENTRATION_INCREASED", before: previous.largestPositionPct, after: current.largestPositionPct });
  return { status: changes.length ? "REVIEW" : "NO_OBSERVED_CHANGE", changes };
}

export function formatVaultUnits(value, decimals) {
  if (uint(value) === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  if (decimals === 0) return value;
  const digits = value.padStart(decimals + 1, "0");
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}
