const validSources = new Set(["LENDING", "DEX_SWAP", "DEX_LP"]);

function check(id, label, outcome, detail) { return { id, label, outcome, detail }; }

export function createActionPreview({ source, position, sourceReceiptId, network = "Arc", chainId = 5042, now = () => new Date() }) {
  if (!validSources.has(source)) throw new Error("A supported Action Center source is required.");
  if (!position || !Number.isFinite(position.amountUsd) || position.amountUsd <= 0) throw new Error("A positive modeled position is required.");
  const targetId = source === "LENDING" ? position.marketId : position.pairAddress;
  const checks = [
    check("network", "Supported network", network === "Arc" && chainId === 5042 ? "pass" : "block", `${network} · chain ${chainId}`),
    check("identity", "Target identity", /^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(targetId ?? "") ? "pass" : "block", targetId ?? "Missing target identity"),
    check("amount", "Bounded amount", position.amountUsd > 0 ? "pass" : "block", `${position.amountUsd} USD modeled`),
    check("evidence", "Source receipt", /^.+-[a-f0-9]{16}$/.test(sourceReceiptId ?? "") ? "pass" : "block", sourceReceiptId ?? "Missing source receipt"),
    check("execution", "Execution boundary", "review", "No wallet, allowance, calldata, signature, gas quote or transaction is created.")
  ];
  if (source === "DEX_SWAP") checks.push(check("route", "Official route evidence", position.officialQuoteAvailable ? "pass" : "review", position.officialQuoteAvailable ? "Quote evidence is attached but must be refreshed." : "Official route quote is still required."));
  if (source === "DEX_LP") checks.push(check("fees", "Verified fee history", "review", "Verified fee yield and position range are not connected."));
  if (source === "LENDING") checks.push(check("market-status", "Scout status", position.scoutStatus === "PASS" ? "pass" : "review", `Source Scout result: ${position.scoutStatus ?? "Unavailable"}`));
  const blockers = checks.filter((item) => item.outcome === "block");
  const reviews = checks.filter((item) => item.outcome === "review");
  return {
    schema: "cofferhouse.action.preview.v1",
    createdAt: now().toISOString(),
    source,
    sourceReceiptId,
    network,
    chainId,
    target: { id: targetId, name: position.marketName ?? position.pairName ?? "Unknown target" },
    intent: { kind: source === "LENDING" ? "SUPPLY_RESEARCH" : source === "DEX_SWAP" ? "SWAP_RESEARCH" : "LP_RESEARCH", amountUsd: position.amountUsd },
    checks,
    status: blockers.length ? "BLOCKED" : reviews.length ? "HUMAN_REVIEW_REQUIRED" : "READY_FOR_HUMAN_REVIEW",
    blockers: blockers.map((item) => item.detail),
    missingBeforeExecution: ["Connected wallet identity", "Fresh balance and allowance state", "Fresh protocol or router simulation", "Exact calldata and gas estimate", "Independent contract/security review", "Explicit wallet signature"],
    notice: "Read-only action preview. This artifact cannot move funds, approve tokens, sign or submit a transaction."
  };
}

export function createActionApproval({ preview, operator, note = "", informedApproval = false, now = () => new Date() }) {
  if (preview?.schema !== "cofferhouse.action.preview.v1") throw new Error("A valid action preview is required.");
  if (preview.status === "BLOCKED") throw new Error("A blocked action preview cannot be approved.");
  const safeOperator = String(operator ?? "").trim();
  if (safeOperator.length < 2 || safeOperator.length > 80) throw new Error("Operator name must contain 2 to 80 characters.");
  if (informedApproval !== true && informedApproval !== "on") throw new Error("Informed approval is required.");
  const safeNote = String(note ?? "").trim();
  if (safeNote.length > 500) throw new Error("Approval note exceeds 500 characters.");
  const approvedAt = now();
  return {
    schema: "cofferhouse.action.approval.v1",
    previewCreatedAt: preview.createdAt,
    sourceReceiptId: preview.sourceReceiptId,
    target: preview.target,
    intent: preview.intent,
    operator: safeOperator,
    note: safeNote,
    confirmation: {
      informedApproval: true,
      understoodBoundaries: ["Preview does not execute.", "Visible warnings and missing evidence were presented.", "A fresh simulation is required before any future signature."]
    },
    decision: "APPROVED_FOR_MANUAL_PREPARATION_ONLY",
    approvedAt: approvedAt.toISOString(),
    expiresAt: new Date(approvedAt.getTime() + 15 * 60_000).toISOString(),
    notice: "This approval authorizes only a later fresh manual preparation step. It is not a wallet signature or transaction authorization."
  };
}
