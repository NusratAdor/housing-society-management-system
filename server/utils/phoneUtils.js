import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalize a phone number into canonical E.164 format.
 *
 * Examples:
 *
 * Bangladesh:
 *   01712345678
 *   +8801712345678
 *   8801712345678
 *
 * All become:
 *   +8801712345678
 *
 * International:
 *   +14155552671
 *   +447911123456
 *
 * remain canonical E.164 values.
 *
 * For numbers without a country code, Bangladesh is assumed.
 * International numbers should preferably be supplied with +countryCode.
 */
export const normalizePhone = (input) => {
  if (!input || typeof input !== "string") {
    return "";
  }

  const value = input.trim();

  if (!value) {
    return "";
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(value, "BD");

    if (!phoneNumber || !phoneNumber.isValid()) {
      return "";
    }

    return phoneNumber.number;
  } catch {
    return "";
  }
};

/**
 * Validate a phone number.
 *
 * Supports:
 *   - Bangladesh numbers
 *   - International numbers
 *
 * Canonical storage format:
 *   E.164
 */
export const isValidPhone = (input) => {
  return Boolean(normalizePhone(input));
};