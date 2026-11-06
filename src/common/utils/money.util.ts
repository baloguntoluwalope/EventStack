/** 500000 kobo -> "5000.00" */
export function minorToDecimalString(minor: number, exponent = 2): string {
  if (!Number.isInteger(minor) || minor < 0) throw new Error(`Invalid minor amount: ${minor}`);
  const digits = minor.toString().padStart(exponent + 1, '0');
  const whole = digits.slice(0, digits.length - exponent);
  const frac = digits.slice(digits.length - exponent);
  return exponent === 0 ? whole : `${whole}.${frac}`;
}

/** "5000.00" -> 500000. Returns null for anything malformed or too precise. */
export function decimalStringToMinor(value: unknown, exponent = 2): number | null {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  if (frac.length > exponent && /[1-9]/.test(frac.slice(exponent))) return null; // would lose precision
  const padded = (frac + '0'.repeat(exponent)).slice(0, exponent);
  const minor = Number(whole + padded);
  return Number.isSafeInteger(minor) ? minor : null;
}