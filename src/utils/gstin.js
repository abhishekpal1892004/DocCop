import { z } from 'zod';

/**
 * GSTIN: 2-digit state code + 10-char PAN + entity number + 'Z' + checksum character.
 * A valid format/checksum proves only that the number is well-formed, NOT that the registration is active.
 */
const GSTIN_REGEX = /^(0[1-9]|[12]\d|3[0-8]|97|99)[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const normalizeGstin = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

export const computeGstinChecksum = (first14) => {
  let sum = 0;
  [...first14].forEach((ch, i) => {
    const product = CHARSET.indexOf(ch) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  });
  return CHARSET[(36 - (sum % 36)) % 36];
};

export const isValidGstin = (value) => {
  const g = normalizeGstin(value);
  return GSTIN_REGEX.test(g) && computeGstinChecksum(g.slice(0, 14)) === g[14];
};

/** Zod schema: trims, uppercases and validates format + checksum. */
export const gstinSchema = z
  .string()
  .transform(normalizeGstin)
  .refine(isValidGstin, 'Invalid GSTIN (format or checksum)');
