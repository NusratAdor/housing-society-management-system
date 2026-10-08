const TIMEZONE = "Asia/Dhaka";

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

  // Asia/Dhaka is UTC+6.
  return new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0) - 6 * 60 * 60 * 1000,
  );
};


export const isFutureDhakaMonth = (year, month) => {
  const {
    year: currentYear,
    month: currentMonth,
  } = getDhakaDateParts();

  return (
    year > currentYear ||
    (year === currentYear && month > currentMonth)
  );
};