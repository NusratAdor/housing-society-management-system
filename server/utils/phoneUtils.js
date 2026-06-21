// server/utils/phoneUtils.js
// Single source of truth for phone normalization and validation.
// Previously this logic was copy-pasted into adminController.js,
// memberController.js, and two frontend files — four separate copies
// that could drift from each other. Now there is exactly one place
// to change if BD operator prefixes ever expand.

/**
 * Strips country code and non-digit characters.
 * Accepts: +8801712345678 | 8801712345678 | 01712345678 | 017-1234-5678
 * Returns: 01712345678
 */
export const normalizePhone = (input) => {
  if (!input) return "";
  return input
    .replace(/[^0-9]/g, "")  // remove everything that is not a digit
    .replace(/^880/, "")      // strip BD country code if present
    .replace(/^0+/, "0");     // collapse multiple leading zeros to one
};

/**
 * Returns true if the input is a valid 11-digit Bangladeshi mobile number.
 * Valid prefixes: 013 014 015 016 017 018 019
 */
export const isValidPhone = (input) => {
  const normalized = normalizePhone(input);
  return /^(013|014|015|016|017|018|019)\d{8}$/.test(normalized);
};