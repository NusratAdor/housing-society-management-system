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

// Combined count across ALL email types, sent today.
export const getSentTodayCount = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return EmailQueueItem.countDocuments({
    status: "sent",
    sentAt: { $gte: startOfToday },
  });
};

// Count for ONE specific type, sent today.
export const getSentTodayCountByType = async (type) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return EmailQueueItem.countDocuments({
    type,
    status: "sent",
    sentAt: { $gte: startOfToday },
  });
};