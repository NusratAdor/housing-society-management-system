import { parsePhoneNumberFromString } from "libphonenumber-js";

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

export const isValidPhone = (input) => {
  return Boolean(normalizePhone(input));
};