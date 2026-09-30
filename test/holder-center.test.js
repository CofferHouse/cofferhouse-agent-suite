import test from "node:test";
import assert from "node:assert/strict";
import { holderAccess, loadHolderPreferences, nextAscension, normalizeRewardMode, saveHolderPreferences } from "../packages/agent-modules/index.js";

test("holder access follows permanent progression levels", () => {
  const member = holderAccess("member");
  assert.equal(member.find((item) => item.id === "agents").unlocked, true);
  assert.equal(member.find((item) => item.id === "dca").unlocked, false);
  assert.equal(holderAccess("partner").find((item) => item.id === "grid").unlocked, true);
});

test("ascension reports the next token threshold", () => {
  assert.deepEqual(nextAscension("builder"), { id: "steward", label: "Steward", cofferThreshold: 80_000 });
  assert.equal(nextAscension("keyholder"), null);
});

test("reward preference is normalized and stored locally", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(normalizeRewardMode("not-real"), "hold-usdc");
  saveHolderPreferences(storage, { rewardMode: "dca-coffers" });
  assert.equal(loadHolderPreferences(storage).rewardMode, "dca-coffers");
});
