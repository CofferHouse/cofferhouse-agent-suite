import { verifyReceiptDocument } from "../../src/receipt.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (Number(request.headers["content-length"] ?? 0) > 1_048_576) return response.status(413).json({ ok: false, valid: false, error: "Receipt exceeds 1 MB." });
  try {
    const receipt = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const verification = verifyReceiptDocument(receipt);
    return response.status(verification.valid ? 200 : 422).json({ ok: verification.valid, receiptId: receipt?.receiptId ?? null, ...verification });
  } catch (error) {
    return response.status(400).json({ ok: false, valid: false, error: error.message });
  }
}
