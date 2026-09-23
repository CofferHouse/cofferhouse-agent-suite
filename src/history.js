const STORAGE_KEY = "cofferhouse.scout.monitor-history.v1";
const MAX_ENTRIES = 10;

export function loadMonitorHistory(storage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function addMonitorObservation(history, comparison, scannedAt = new Date().toISOString()) {
  const entry = {
    id: `scan-${scannedAt}`,
    scannedAt,
    previousObservedAt: comparison.previousObservedAt ?? null,
    currentObservedAt: comparison.currentObservedAt ?? null,
    materialChanges: comparison.materialChanges ?? 0,
    changes: Array.isArray(comparison.changes) ? comparison.changes : []
  };
  return [entry, ...history].slice(0, MAX_ENTRIES);
}

export function saveMonitorHistory(storage, history) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

export function clearMonitorHistory(storage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
  return [];
}
