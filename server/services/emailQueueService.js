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
import { getStartOfDhakaDay } from "../utils/dateTime.js";

export const enqueueEmail = async ({ to, subject, type, payload, dedupeKey }) => {
  try {
    return await EmailQueueItem.create({
      to, subject, type, payload,
      ...(dedupeKey ? { dedupeKey } : {}),
    });
  } catch (error) {
    // The same business event is already queued/sent: not an error.
    if (error?.code === 11000 && dedupeKey) return null;
    throw error;
  }
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