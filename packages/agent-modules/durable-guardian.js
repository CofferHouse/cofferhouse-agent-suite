import { evaluateMarket } from "../policies/index.js";
import { createGuardianReceipt } from "../evidence/index.js";
import { evaluateGuardian, guardianEvidenceFromLending } from "./guardian.js";

export function evaluateDurableGuardianRegistration({ registration, markets, targetObservation, policy, now = () => new Date() }) {
  if (registration?.schema !== "cofferhouse.guardian.registration.v1" || registration.watch?.schema !== "cofferhouse.guardian.watch.v1") throw new Error("A valid durable Guardian registration is required.");
  if (registration.watch.source !== "LENDING") throw new Error("Durable Guardian currently supports lending watches only.");
  if (!Array.isArray(markets)) throw new Error("Current lending market observations are required.");
  const targetId = registration.watch.target?.id?.toLowerCase();
  const watchedMarket = targetObservation === undefined
    ? markets.find((market) => market.marketId?.toLowerCase() === targetId)
    : targetObservation?.status === "FOUND" && targetObservation.targetId === targetId && targetObservation.market?.marketId?.toLowerCase() === targetId && targetObservation.market?.chainId === 5042 ? targetObservation.market : null;
  const evidence = watchedMarket ? guardianEvidenceFromLending(watchedMarket, evaluateMarket(watchedMarket, policy)) : null;
  let observation = evaluateGuardian(registration.watch, evidence, now);
  if (targetObservation !== undefined && watchedMarket) observation = { ...observation, sourceDiagnostic: { source: "Morpho API · exact Arc target query", status: "FOUND", observedAt: targetObservation.observedAt ?? watchedMarket.observedAt } };
  if (targetObservation !== undefined && !watchedMarket) {
    observation = { ...observation, decision: "REVIEW", requiresHumanAttention: true,
      reasons: ["The exact watched target could not be observed in the Arc index. This does not prove that the market disappeared; refresh its evidence before any action."],
      sourceDiagnostic: { source: "Morpho API · exact Arc target query", status: targetObservation?.targetId === targetId && targetObservation?.status !== "FOUND" ? targetObservation.status : "UNAVAILABLE", code: targetObservation?.targetId === targetId && targetObservation?.status !== "FOUND" ? targetObservation.code ?? "MISSING_OBSERVATION" : "IDENTITY_MISMATCH" }
    };
  }
  return createGuardianReceipt(registration.watch, observation);
}

export function evaluateDurableGuardianPortfolio({ registrations, markets, targetObservations, policy, now = () => new Date(), maxWatches = 20 }) {
  const normalized = (Array.isArray(registrations) ? registrations : registrations ? [registrations] : []).filter(Boolean);
  if (normalized.length > maxWatches) throw new Error(`Durable Guardian supports up to ${maxWatches} simultaneous watches.`);
  const targetIds = new Set();
  if (targetObservations !== undefined && (!Array.isArray(targetObservations) || new Set(targetObservations.map(item => item?.targetId)).size !== targetObservations.length)) throw new Error("Exact target observations require unique identities.");
  return normalized.map((registration) => {
    const targetId = registration.watch?.target?.id?.toLowerCase();
    if (!targetId || targetIds.has(targetId)) throw new Error("Durable Guardian registrations require unique target identities.");
    targetIds.add(targetId);
    const targetObservation = targetObservations === undefined ? undefined : targetObservations.find(item => item?.targetId === targetId) ?? { targetId, status: "UNAVAILABLE", code: "MISSING_OBSERVATION" };
    return evaluateDurableGuardianRegistration({ registration, markets, targetObservation, policy, now });
  });
}
