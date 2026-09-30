import { sealDocument, verifySealedDocument } from "./integrity.js";

const STORAGE_KEY = "cofferhouse.operator-workspace.v1";
const address = /^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/;

const same = (left, right) => String(left ?? "").toLowerCase() === String(right ?? "").toLowerCase();

function validPreview(value) {
  return value?.schema === "cofferhouse.action.preview.v1"
    && address.test(value.target?.id ?? "")
    && Number.isFinite(value.intent?.amountUsd)
    && value.intent.amountUsd > 0
    && /^.+-[a-f0-9]{16}$/.test(value.sourceReceiptId ?? "");
}

function validApproval(value, preview) {
  return value?.schema === "cofferhouse.action.approval.v1"
    && value.confirmation?.informedApproval === true
    && same(value.sourceReceiptId, preview.sourceReceiptId)
    && same(value.target?.id, preview.target.id)
    && Number.isFinite(new Date(value.expiresAt).getTime());
}

function validWatch(value, preview, approval) {
  return value?.schema === "cofferhouse.guardian.watch.v1"
    && same(value.target?.id, preview.target.id)
    && same(value.sourceReceiptId, preview.sourceReceiptId)
    && value.approval?.operator === approval.operator;
}

export function createOperatorWorkspaceSnapshot({ actionPreview = null, actionApproval = null, guardianWatch = null, guardianObservation = null, automationPolicy = null, automationEvaluation = null, now = () => new Date() } = {}) {
  if (actionPreview && !validPreview(actionPreview)) throw new Error("A valid Action Center preview is required.");
  if (actionApproval && (!actionPreview || !validApproval(actionApproval, actionPreview))) throw new Error("Action approval does not match its preview.");
  if (guardianWatch && (!actionApproval || !validWatch(guardianWatch, actionPreview, actionApproval))) throw new Error("Guardian watch does not match the approved intent.");
  if (guardianObservation && (guardianObservation.schema !== "cofferhouse.guardian.observation.v1" || !guardianWatch || !same(guardianObservation.target?.id, guardianWatch.target.id))) throw new Error("Guardian observation does not match its watch.");
  if (automationPolicy && (automationPolicy.schema !== "cofferhouse.automation.policy.v1" || !guardianWatch || !automationPolicy.allowlistedTargets?.some((item) => same(item, guardianWatch.target.id)))) throw new Error("Automation policy does not match its Guardian watch.");
  if (automationEvaluation && (automationEvaluation.schema !== "cofferhouse.automation.evaluation.v1" || !automationPolicy)) throw new Error("Automation evaluation requires its policy.");
  return sealDocument({
    schema: "cofferhouse.operator-workspace.v1",
    savedAt: now().toISOString(),
    actionPreview,
    actionApproval,
    guardianWatch,
    guardianObservation,
    automationPolicy,
    automationEvaluation,
    execution: { prepared: false, signed: false, submitted: false }
  }, "workspace");
}

export function saveOperatorWorkspace(storage, state) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(createOperatorWorkspaceSnapshot(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadOperatorWorkspace(storage) {
  try {
    const snapshot = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (snapshot?.schema !== "cofferhouse.operator-workspace.v1" || !verifySealedDocument(snapshot).valid) return null;
    const { actionPreview, actionApproval, guardianWatch, guardianObservation, automationPolicy, automationEvaluation } = snapshot;
    createOperatorWorkspaceSnapshot({ actionPreview, actionApproval, guardianWatch, guardianObservation, automationPolicy, automationEvaluation, now: () => new Date(snapshot.savedAt) });
    return { actionPreview, actionApproval, guardianWatch, guardianObservation, automationPolicy, automationEvaluation, savedAt: snapshot.savedAt };
  } catch {
    return null;
  }
}

export function clearOperatorWorkspace(storage) {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* In-memory reset remains safe. */ }
}
