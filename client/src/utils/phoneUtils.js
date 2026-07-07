// client/src/utils/phoneUtils.js
// Mirror of server/utils/phoneUtils.js for frontend validation.
// Keeps validation rules identical on both sides.

export const normalizePhone = (input) => {
  if (!input) return "";
  let phone = input.trim();
  if (phone.startsWith("+880")) phone = "0" + phone.slice(4);
  else if (phone.startsWith("880")) phone = "0" + phone.slice(3);
  return phone.replace(/[^0-9]/g, "").replace(/^0+/, "0");
};


export const isValidPhone = (input) => {
  const normalized = normalizePhone(input);
  return /^(013|014|015|016|017|018|019)\d{8}$/.test(normalized);
};