import { timingSafeEqual } from "node:crypto";
import { compareAndSetJson, durableStoreConfigured, getJson } from "../_redis.js";
import { compareVaultExposure, fetchVaultExposure } from "../../packages/arc-data/vault-exposure.js";
import { sealDocument } from "../../packages/evidence/index.js";

const KEY = "cofferhouse:guardian:vault-watches:v1";
const LIMIT = 3;
const address = value => typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null;
const complete = (value, target) => value?.vaultAddress === target && value.chainId === 5042 &&
  value.status === "INDEXED_OBSERVATION" && value.aligned && value.reconciled &&
  typeof value.asset?.address === "string" && Number.isInteger(value.asset.decimals) &&
  /^\d{1,77}$/.test(value.sourceBlocks?.state ?? "") && Array.isArray(value.positions);

export async function observeVaultWatch(watch, { observe = fetchVaultExposure, now = () => new Date().toISOString() } = {}) {
  let current = null;
  let comparison = { status: "UNAVAILABLE", changes: [] };
  try {
    const data = await observe(watch.target);
    if (data?.vaultAddress === watch.target && data.chainId === 5042) {
      current = data;
      comparison = compareVaultExposure(watch.baseline, current);
      const previous = watch.latest?.current;
      if (previous?.status === "INDEXED_OBSERVATION" && /^\d{1,78}$/.test(previous.sourceBlocks?.state ?? "") &&
          /^\d{1,78}$/.test(current.sourceBlocks?.state ?? "") && BigInt(current.sourceBlocks.state) < BigInt(previous.sourceBlocks.state)) {
        comparison = { status: "NOT_COMPARABLE", changes: [] };
      }
    }
  } catch { /* An upstream failure is not evidence of a change. */ }
  return sealDocument({
    schema: "cofferhouse.guardian.vault-watch-receipt.v1", target: watch.target, generatedAt: now(),
    baseline: watch.baseline, current, comparison, automatedAction: false
  }, "guardian-vault");
}

export async function runVaultWatches({ load = getJson, save = compareAndSetJson, observe = fetchVaultExposure } = {}) {
  const state = await load(KEY);
  if (!state?.length) return { count: 0, saved: false };
  const next = await Promise.all(state.slice(0, LIMIT).map(async watch => ({
    ...watch, latest: await observeVaultWatch(watch, { observe })
  })));
  return { count: next.length, saved: await save(KEY, state, next) };
}

export function createVaultWatchHandler({ load = getJson, save = compareAndSetJson, observe = fetchVaultExposure, configured = durableStoreConfigured, token = () => process.env.SCOUT_OPERATOR_TOKEN } = {}) {
  return async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store");
    const raw = request.headers?.authorization;
    const expected = token();
    const supplied = typeof raw === "string" && raw.startsWith("Bearer ") ? Buffer.from(raw.slice(7)) : Buffer.alloc(0);
    if (!expected || supplied.length !== Buffer.byteLength(expected) || !timingSafeEqual(supplied, Buffer.from(expected))) return response.status(401).json({ ok: false, error: "Unauthorized." });
    if (!["GET", "POST", "DELETE"].includes(request.method)) return response.status(405).json({ ok: false, error: "Method not allowed." });
    if (!configured()) return response.status(503).json({ ok: false, error: "Durable store unavailable." });
    try {
      const state = await load(KEY);
      const watches = state ?? [];
      if (request.method === "GET") return response.status(200).json({ ok: true, watches });
      const target = address(request.method === "POST" ? request.body?.vault : request.query?.vault ?? new URL(request.url, "https://cofferhouse.invalid").searchParams.get("vault"));
      if (!target) return response.status(400).json({ ok: false, error: "A valid vault address is required." });
      let next = watches.filter(item => item.target !== target);
      if (request.method === "POST") {
        if (request.body?.approveBaseline !== true) return response.status(400).json({ ok: false, error: "Explicit baseline approval is required." });
        if (next.length >= LIMIT) return response.status(409).json({ ok: false, error: "Vault watch limit reached." });
        const baseline = await observe(target);
        if (!complete(baseline, target)) return response.status(422).json({ ok: false, error: "A complete aligned vault baseline is required." });
        next = [...next, { target, approvedAt: new Date().toISOString(), baseline, latest: null }];
      }
      if (!await save(KEY, state, next)) return response.status(409).json({ ok: false, error: "Watch state changed; retry." });
      return response.status(200).json({ ok: true, watchCount: next.length });
    } catch {
      return response.status(503).json({ ok: false, error: "Vault watch data is unavailable." });
    }
  };
}
export default createVaultWatchHandler();
