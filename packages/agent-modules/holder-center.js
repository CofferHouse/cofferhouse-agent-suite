export const holderLevels = Object.freeze([
  { id: "member", label: "Member", cofferThreshold: 0 },
  { id: "builder", label: "Builder", cofferThreshold: 20_000 },
  { id: "steward", label: "Steward", cofferThreshold: 80_000 },
  { id: "partner", label: "Partner", cofferThreshold: 320_000 },
  { id: "keyholder", label: "Keyholder", cofferThreshold: 1_000_000 }
]);

export const holderServices = Object.freeze([
  { id: "agents", label: "Agent Suite", level: "member", status: "preview", view: "hub", description: "Market research, risk evidence and bounded agent workflows." },
  { id: "dca", label: "DCA", level: "builder", status: "roadmap", description: "Configure a future recurring allocation preference." },
  { id: "big-coffer", label: "Big Coffer", level: "steward", status: "roadmap", description: "Collective strategy access with additional controls." },
  { id: "grid", label: "Grid", level: "partner", status: "roadmap", description: "Advanced modeled strategy tooling." },
  { id: "advanced", label: "Advanced agents", level: "keyholder", status: "preview", view: "scout", description: "Broadest research and monitoring access." }
]);

export const rewardModes = Object.freeze([
  { id: "hold-usdc", label: "Hold rewards in USDC" },
  { id: "dca-coffers", label: "DCA into $COFFERS" },
  { id: "dca-approved", label: "DCA into an approved asset" }
]);

export function levelIndex(levelId) {
  return Math.max(0, holderLevels.findIndex((level) => level.id === levelId));
}

export function holderAccess(levelId = "member") {
  const current = levelIndex(levelId);
  return holderServices.map((service) => ({ ...service, unlocked: current >= levelIndex(service.level) }));
}

export function nextAscension(levelId = "member") {
  const current = levelIndex(levelId);
  return holderLevels[current + 1] ?? null;
}

export function normalizeRewardMode(value) {
  return rewardModes.some((mode) => mode.id === value) ? value : rewardModes[0].id;
}

export function loadHolderPreferences(storage) {
  try {
    const saved = JSON.parse(storage?.getItem("cofferhouse-holder-preferences") ?? "{}");
    return Object.freeze({ rewardMode: normalizeRewardMode(saved.rewardMode) });
  } catch {
    return Object.freeze({ rewardMode: rewardModes[0].id });
  }
}

export function saveHolderPreferences(storage, preferences) {
  const value = { rewardMode: normalizeRewardMode(preferences?.rewardMode) };
  storage?.setItem("cofferhouse-holder-preferences", JSON.stringify(value));
  return Object.freeze(value);
}
