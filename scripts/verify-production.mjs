const origin = new URL(process.argv[2] ?? process.env.SCOUT_AGENT_URL ?? "https://cofferhouse-scout.vercel.app");
const readJson = async (path) => {
  const response = await fetch(new URL(path, origin), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
};

const [health, status] = await Promise.all([readJson("/api/health"), readJson("/api/agent/status")]);
const report = {
  origin: origin.origin,
  checkedAt: new Date().toISOString(),
  health: health.deployment?.status ?? "UNKNOWN",
  readyForUnattendedCycles: health.readyForUnattendedCycles === true,
  lastRunAt: status.lastRunAt ?? status.status?.ranAt ?? null,
  decision: status.decision ?? status.status?.decision?.action ?? null,
  historyCount: status.summaryCounts?.history ?? 0,
  required: health.deployment?.required ?? [],
  recommended: health.deployment?.recommended ?? []
};
console.log(JSON.stringify(report, null, 2));
if (!health.ok) process.exitCode = 1;
if (!report.readyForUnattendedCycles) process.exitCode = 2;
if (report.health !== "OPERATIONAL") process.exitCode = 3;
