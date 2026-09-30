const STORAGE_KEY = "cofferhouse.scout.alert-limits.v1";
export const defaultAlertLimits = { liquidityChangePct: 5, utilizationChangePts: 2 };

export function normalizeAlertLimits(value = {}) {
  const liquidityChangePct = Number(value.liquidityChangePct);
  const utilizationChangePts = Number(value.utilizationChangePts);
  return {
    liquidityChangePct: Number.isFinite(liquidityChangePct) && liquidityChangePct > 0 ? liquidityChangePct : defaultAlertLimits.liquidityChangePct,
    utilizationChangePts: Number.isFinite(utilizationChangePts) && utilizationChangePts > 0 ? utilizationChangePts : defaultAlertLimits.utilizationChangePts
  };
}

export function loadAlertLimits(storage) {
  try {
    return normalizeAlertLimits(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "{}"));
  } catch {
    return { ...defaultAlertLimits };
  }
}

export function saveAlertLimits(storage, limits) {
  const normalized = normalizeAlertLimits(limits);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Keep the active in-memory limits when browser storage is unavailable.
  }
  return normalized;
}
