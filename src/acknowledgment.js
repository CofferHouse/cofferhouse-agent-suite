export function createAcknowledgment({ fingerprint, operator, note = "", now = () => new Date() }) {
  if (!/^alert-[a-f0-9]{8}$/.test(fingerprint ?? "")) throw new Error("A valid alert fingerprint is required.");
  const safeOperator = String(operator ?? "").trim();
  if (safeOperator.length < 2 || safeOperator.length > 80) throw new Error("Operator name must contain 2 to 80 characters.");
  const safeNote = String(note).trim();
  if (safeNote.length > 500) throw new Error("Acknowledgment note exceeds 500 characters.");
  return {
    schema: "cofferhouse.scout.acknowledgment.v1",
    fingerprint,
    operator: safeOperator,
    note: safeNote,
    acknowledgedAt: now().toISOString()
  };
}
