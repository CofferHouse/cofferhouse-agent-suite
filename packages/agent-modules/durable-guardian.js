import { evaluateMarket } from "../policies/index.js";
import { createGuardianReceipt } from "../evidence/index.js";
import { evaluateGuardian, guardianEvidenceFromLending } from "./guardian.js";

export function evaluateDurableGuardianRegistration({ registration, markets, policy, now = () => new Date() }) {
  if (registration?.schema !== "cofferhouse.guardian.registration.v1" || registration.watch?.schema !== "cofferhouse.guardian.watch.v1") throw new Error("A valid durable Guardian registration is required.");
  if (registration.watch.source !== "LENDING") throw new Error("Durable Guardian currently supports lending watches only.");
  if (!Array.isArray(markets)) throw new Error("Current lending market observations are required.");
  const watchedMarket = markets.find((market) => market.marketId?.toLowerCase() === registration.watch.target?.id?.toLowerCase());
  const evidence = watchedMarket ? guardianEvidenceFromLending(watchedMarket, evaluateMarket(watchedMarket, policy)) : null;
  const observation = evaluateGuardian(registration.watch, evidence, now);
  return createGuardianReceipt(registration.watch, observation);
}

export function evaluateDurableGuardianPortfolio({ registrations, markets, policy, now = () => new Date(), maxWatches = 20 }) {
  const normalized = (Array.isArray(registrations) ? registrations : registrations ? [registrations] : []).filter(Boolean);
  if (normalized.length > maxWatches) throw new Error(`Durable Guardian supports up to ${maxWatches} simultaneous watches.`);
  const targetIds = new Set();
  return normalized.map((registration) => {
    const targetId = registration.watch?.target?.id?.toLowerCase();
    if (!targetId || targetIds.has(targetId)) throw new Error("Durable Guardian registrations require unique target identities.");
    targetIds.add(targetId);
    return evaluateDurableGuardianRegistration({ registration, markets, policy, now });
  });
}
