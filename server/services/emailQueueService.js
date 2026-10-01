// server/services/emailQueueService.js
//
// Confirmations, advance confirmations, and reminders all share one
// total daily safety budget, but are not treated equally: confirmations
// (both kinds) are time-sensitive — a member is waiting on their
// receipt — and are always dispatched first, with no fixed ceiling of
// their own. Reminders always run second and are capped at
// REMINDER_DAILY_CAP regardless of how much room is left, so a quiet
// confirmation day never lets reminder volume balloon past the
// intended limit. See paymentJobs.js for the dispatcher that uses this.

import EmailQueueItem from "../models/EmailQueueItem.js";

export const enqueueEmail = async ({ to, subject, type, payload }) => {
  return EmailQueueItem.create({ to, subject, type, payload });
};

const TIMEZONE = "Asia/Dhaka";

const getStartOfDhakaDay = () => {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  // Dhaka is UTC+6 and does not observe DST.
  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      0,
      0,
      0,
    ) - 6 * 60 * 60 * 1000,
  );
};

export const getSentTodayCount = async () => {
  const startOfToday = getStartOfDhakaDay();

  return EmailQueueItem.countDocuments({
    status: "sent",
    sentAt: { $gte: startOfToday },
  });
};

export const getSentTodayCountByType = async (type) => {
  const startOfToday = getStartOfDhakaDay();

  return EmailQueueItem.countDocuments({
    status: "sent",
    type,
    sentAt: { $gte: startOfToday },
  });
};