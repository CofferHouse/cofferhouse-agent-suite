// Adapted from 4mica Network (c) 2025, MIT. See LICENSES/4mica-MIT.txt.
// Upstream f9757b79de87fee65efe1e9e4d8dc05b4c6dd045/packages/sdk/src/x402/base64.ts
// CofferHouse changes: JavaScript, bounded canonical input and fatal UTF-8 decoding.
export function decodePaymentRequired(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32768 || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid PAYMENT-REQUIRED encoding.');
  const binary = atob(value);
  if (btoa(binary) !== value) throw new Error('Noncanonical PAYMENT-REQUIRED encoding.');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
