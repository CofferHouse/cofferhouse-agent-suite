// Exact decimal-string arithmetic. No price or token-unit conversion is implied.
const scale = 10n ** 18n;
export function decimalUnits(value, signed = false) {
  if (typeof value !== "string" || !(signed ? /^-?\d{1,32}(\.\d{1,18})?$/ : /^\d{1,32}(\.\d{1,18})?$/).test(value)) return null;
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const units = BigInt(whole) * scale + BigInt(fraction.padEnd(18, "0"));
  return value.startsWith("-") ? -units : units;
}
export function decimalText(units) {
  if (units === null) return null;
  const negative = units < 0n, absolute = negative ? -units : units;
  const fraction = String(absolute % scale).padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${absolute / scale}${fraction ? `.${fraction}` : ""}`;
}
