// client/src/utils/formatDate.js
//
// Every date shown to a user is formatted in Asia/Dhaka, never in the device
// timezone, so the web app, the receipt PDF and the emails all show the same
// day for the same payment.
//
// formatDate(value)           → "9 Oct, 2026"   (same output as before)
// formatDate(value, options)  → any Intl format, still in Dhaka time
// Do not build display dates from new Date("YYYY-MM-DD"): that parses as UTC.

const TZ = "Asia/Dhaka";

export const formatDate = (value, options) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  if (options) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...options }).format(date);
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      day: "numeric",
      month: "short",
      year: "numeric",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );

  return `${parts.day} ${parts.month}, ${parts.year}`;
};

// Today in Dhaka as "YYYY-MM-DD" (value and max of <input type="date">,
// and the format the reports API expects).
export const getDhakaDateInputValue = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);

// Dhaka today minus N months as "YYYY-MM-DD" (default export start date).
// Day is clamped, so Oct 31 minus 1 month is Sep 30, not Oct 1.
export const getDhakaDateMonthsAgo = (months) => {
  const [year, month, day] = getDhakaDateInputValue().split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 - months, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
};

// { year, month } of the current Dhaka calendar month.
export const getDhakaYearMonth = (date = new Date()) => {
  const [year, month] = getDhakaDateInputValue(date).split("-").map(Number);
  return { year, month };
};

export const DATE_TIME = {
  day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
};