const TIMEZONE = "Asia/Dhaka";
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

export const getDhakaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

export const getStartOfDhakaDay = (date = new Date()) => {
  const { year, month, day } = getDhakaDateParts(date);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - DHAKA_OFFSET_MS);
};

// First millisecond of a Dhaka calendar month. `month` is 1-12; Date.UTC rolls
// over, so getStartOfDhakaMonth(2026, 0) is December 2025.
export const getStartOfDhakaMonth = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1) - DHAKA_OFFSET_MS);

export const isFutureDhakaMonth = (year, month) => {
  const { year: currentYear, month: currentMonth } = getDhakaDateParts();
  return (
    year > currentYear ||
    (year === currentYear && month > currentMonth)
  );
};

// "YYYY-MM-DD" → { year, month, day }, or null if malformed / not a real date
// (rejects 2026-02-31).
export const parseDateString = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

// First and last millisecond of that calendar day in Dhaka time.
export const getDhakaDayBounds = ({ year, month, day }) => {
  const startMs = Date.UTC(year, month - 1, day) - DHAKA_OFFSET_MS;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS - 1) };
};