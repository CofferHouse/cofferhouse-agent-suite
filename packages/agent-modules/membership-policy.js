export const membershipWeights = Object.freeze([0, 2, 4, 7, 10, 16]);

export function sacrificePreview(memberships, survivorId, sacrificeIds) {
  if (!sacrificeIds.length || new Set(sacrificeIds.map(String)).size !== sacrificeIds.length || sacrificeIds.map(String).includes(String(survivorId))) throw Error("Select different memberships to burn.");
  const survivor = memberships.find(x => String(x.id) === String(survivorId));
  if (!survivor || survivor.level < 1 || survivor.level >= 5) throw Error("The surviving membership must be activated and below level 5.");
  const target = survivor.level + 1;
  const requiredLevel = target - sacrificeIds.length;
  if (requiredLevel < 0 || sacrificeIds.some(id => !memberships.some(x => String(x.id) === String(id) && x.level === requiredLevel))) throw Error(`To reach level ${target}, select ${sacrificeIds.length} membership(s) at level ${requiredLevel}.`);
  return Object.freeze({ survivorId: String(survivorId), sacrificeIds: sacrificeIds.map(String), target, requiredLevel });
}

export function rewardStatus(epoch, claimed, paused, nowSeconds) {
  if (claimed) return "CLAIMED";
  if (paused) return "PAUSED";
  return BigInt(nowSeconds) < epoch.availableAt ? "REVIEW" : "CLAIMABLE";
}
