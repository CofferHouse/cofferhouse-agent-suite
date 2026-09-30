export const SERVER_STATUS_REFRESH_MS = 60_000;

export function shouldRefreshRuntimeStatus({ lastCheckedAt = null, visibilityState = "visible", now = () => new Date(), intervalMs = SERVER_STATUS_REFRESH_MS } = {}) {
  if (visibilityState !== "visible") return false;
  if (!lastCheckedAt) return true;
  const checkedAt = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(checkedAt)) return true;
  return now().getTime() - checkedAt >= intervalMs;
}

export function runtimeConnectionLabel({ mode, lastCheckedAt, lastError } = {}) {
  if (mode === "checking" || mode === "refreshing") return { status: "SYNCING", detail: "Requesting the latest protected runtime state." };
  if (mode === "unavailable") return { status: "CONNECTION LOST", detail: lastError ?? "The latest runtime status request failed." };
  if (!lastCheckedAt) return { status: "NOT CHECKED", detail: "No runtime status request has completed." };
  return { status: "CONNECTED", detail: `Last checked ${new Date(lastCheckedAt).toISOString()}.` };
}
