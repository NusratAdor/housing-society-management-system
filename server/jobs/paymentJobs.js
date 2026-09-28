// server/jobs/paymentJobs.js
//
// Daily cron job. Registered once at server startup via runDailyJobs().
//
// Task 1 — 1st of month: create MonthlyCharge for every member at the
// locked fee for that month.
//
// Task 2 — 9 days before month-end: queue due reminder emails. 9 days,
// not 7 — 500 members ÷ 70 reminders/day ≈ 8 days needed worst-case;
// 9 gives a 1-day safety cushion so nobody is left without a reminder.
//
// Email dispatcher (every 5 min): confirmations dispatched first with
// no fixed ceiling of their own; reminders dispatched second, capped
// at 70/day regardless of spare room. Both share one 90/day safe
// budget under Resend's real 100/day limit. A failed send retries
// automatically up to 3 times before being marked permanently failed.

import cron           from "node-cron";
import Member         from "../models/Member.js";
import Payment from "../models/Payment.js";
import Notification   from "../models/Notification.js";
import EmailQueueItem  from "../models/EmailQueueItem.js";
import { createMonthlyChargesForMonth } from "../services/chargeService.js";
import { getMemberDueBreakdown }        from "../services/paymentService.js";
import {
  enqueueEmail,
  getSentTodayCount,
  getSentTodayCountByType,
} from "../services/emailQueueService.js";
import {
  sendPaymentConfirmationEmail,
  sendAdvancePaymentConfirmationEmail,
  sendDueReminderEmail,
} from "../services/emailService.js";

const SAFE_DAILY_CAP     = 90;
const REMINDER_DAILY_CAP = 70;
const MAX_RETRY_ATTEMPTS = 3;
const SEND_GAP_MS        = 120;

const CONFIRMATION_TYPES = ["payment_confirmation", "advance_confirmation"];

const sendQueueItem = async (item) => {
  try {
    if (item.type === "payment_confirmation") {
      await sendPaymentConfirmationEmail({ to: item.to, ...item.payload });
    } else if (item.type === "advance_confirmation") {
      await sendAdvancePaymentConfirmationEmail({ to: item.to, ...item.payload });
    } else if (item.type === "due_reminder") {
      await sendDueReminderEmail({ to: item.to, ...item.payload });
    }
    await EmailQueueItem.updateOne(
      { _id: item._id },
      { $set: { status: "sent", sentAt: new Date() } }
    );
    return true;
  } catch (err) {
    const nextRetryCount = (item.retryCount || 0) + 1;
    const stillRetryable = nextRetryCount < MAX_RETRY_ATTEMPTS;

    await EmailQueueItem.updateOne(
      { _id: item._id },
      {
        $set: {
          status:     stillRetryable ? "pending" : "failed",
          retryCount: nextRetryCount,
          error:      err.message,
        },
      }
    );

    console.error(
      `[EmailQueue] Send failed for ${item.to} (type: ${item.type}, attempt ${nextRetryCount}):`,
      err.message
    );
    return false;
  }
};

export const runMonthlyChargeJob = async (month, year) => {
  const result = await createMonthlyChargesForMonth({
    month, year, performedBy: "SYSTEM",
  });

  console.info(
    `[Cron] Monthly charges: created=${result.created}, ` +
    `skipped=${result.skipped}, fee=৳${result.fee}`
  );

  await Notification.create({
    type:        "Payment",
    content:     `Monthly maintenance fee of ৳${result.fee.toLocaleString()} ` +
                 `has been added for ${month}/${year}. Please pay before month-end.`,
    clerkUserId: null,
    adminOnly:   false,
  });

  return result;
};

export const queueDueReminders = async () => {
  const members = await Member
    .find({ status: "active" })
    .select("_id clerkUserId name email")
    .lean();

  let reminded = 0, skipped = 0, queueFail = 0;

  for (const member of members) {
    const breakdown = await getMemberDueBreakdown(member._id);

    if (breakdown.totalDue === 0) { skipped++; continue; }

    try {
      await Notification.create({
        type:        "Payment",
        content:     `Reminder: You have ৳${breakdown.totalDue.toLocaleString()} ` +
                     `outstanding. Please pay before month-end.`,
        clerkUserId: member.clerkUserId,
        adminOnly:   false,
      });
    } catch (notifErr) {
      console.error(`[Cron] Notification failed for ${member.clerkUserId}:`, notifErr.message);
    }

    try {
      await enqueueEmail({
        to:      member.email,
        subject: `⏰ Payment Reminder — ৳${breakdown.totalDue.toLocaleString()} Due`,
        type:    "due_reminder",
        payload: {
          name:            member.name,
          totalDue:        breakdown.totalDue,
          totalMonthlyDue: breakdown.totalMonthlyDue,
          totalExtraDue:   breakdown.totalExtraDue,
          unpaidMonths:    breakdown.unpaidMonthlyCharges,
          unpaidCharges:   breakdown.unpaidExtraCharges,
        },
      });
      reminded++;
    } catch (queueErr) {
      queueFail++;
      console.error(`[Cron] Failed to queue reminder for ${member.email}:`, queueErr.message);
    }
  }

  console.info(`[Cron] Reminders queued: queued=${reminded}, skipped(paid)=${skipped}, queueFailed=${queueFail}`);
  return { queued: reminded, skipped, queueFail };
};

export const runEmailDispatchCycle = async () => {
  const sentSoFar      = await getSentTodayCount();
  const totalRemaining = SAFE_DAILY_CAP - sentSoFar;

  if (totalRemaining <= 0) {
    return { sent: 0, failed: 0, note: "Day's safe budget already used" };
  }

  const pendingConfirmations = await EmailQueueItem
    .find({ status: "pending", type: { $in: CONFIRMATION_TYPES } })
    .sort({ createdAt: 1 })
    .limit(totalRemaining)
    .lean();

  let sent = 0, failed = 0;

  for (const item of pendingConfirmations) {
    const ok = await sendQueueItem(item);
    ok ? sent++ : failed++;
    await new Promise(r => setTimeout(r, SEND_GAP_MS));
  }

  const sentAfterConfirmations      = await getSentTodayCount();
  const remainingAfterConfirmations = SAFE_DAILY_CAP - sentAfterConfirmations;

  if (remainingAfterConfirmations <= 0) {
    return { sent, failed, note: "No room left for reminders today" };
  }

  const reminderSentToday = await getSentTodayCountByType("due_reminder");
  const reminderRoom      = Math.min(REMINDER_DAILY_CAP - reminderSentToday, remainingAfterConfirmations);

  if (reminderRoom > 0) {
    const pendingReminders = await EmailQueueItem
      .find({ status: "pending", type: "due_reminder" })
      .sort({ createdAt: 1 })
      .limit(reminderRoom)
      .lean();

    for (const item of pendingReminders) {
      const ok = await sendQueueItem(item);
      ok ? sent++ : failed++;
      await new Promise(r => setTimeout(r, SEND_GAP_MS));
    }
  }

  return { sent, failed };
};





// A payment claimed for confirmation (processing) whose allocation never
// finished — the server died mid-request. MongoDB aborts transactions
// after 60 seconds by default, and the driver stops retrying after
// about 2 minutes, so a claim older than this threshold cannot have a
// live allocation. It also cannot have committed (a commit sets the
// status to "completed"), so releasing it back to "verified" is safe.
const STALE_PROCESSING_MINUTES = 10;

export const recoverStaleProcessingPayments = async () => {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000);

  const result = await Payment.updateMany(
    { status: "processing", processingAt: { $lt: cutoff } },
    { $set: { status: "verified" }, $unset: { processingAt: "" } }
  );

  if (result.modifiedCount > 0) {
    console.warn(
      `[Payments] Released ${result.modifiedCount} stale "processing" payment(s) back to "verified"`
    );
  }
  return result.modifiedCount;
};





const runDailyJobs = () => {
  cron.schedule("0 9 * * *", async () => {
    const now            = new Date();
    const currentMonth   = now.getMonth() + 1;
    const currentYear    = now.getFullYear();
    const dayOfMonth     = now.getDate();
    const lastDayOfMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate();

    console.info(
      `[Cron] Daily job — ${String(dayOfMonth).padStart(2, "0")}/${String(currentMonth).padStart(2, "0")}/${currentYear}`
    );

    if (dayOfMonth === 1) {
      try {
        await runMonthlyChargeJob(currentMonth, currentYear);
      } catch (error) {
        console.error("[Cron] Monthly charge creation failed:", error.message);
      }
    }

    if (dayOfMonth === lastDayOfMonth - 9) {
      try {
        await queueDueReminders();
      } catch (error) {
        console.error("[Cron] Reminder job failed:", error.message);
      }
    }
  });

  cron.schedule("*/5 * * * *", async () => {
    try {
      await recoverStaleProcessingPayments();
    } catch (error) {
      console.error("[Payments] Stale-processing recovery failed:", error.message);
    }

    try {
      const result = await runEmailDispatchCycle();
      if (result.sent > 0 || result.failed > 0) {
        console.info(`[EmailQueue] Dispatch run: sent=${result.sent}, failed=${result.failed}${result.note ? ` (${result.note})` : ""}`);
      }
    } catch (error) {
      console.error("[EmailQueue] Dispatcher failed:", error.message);
    }
  });

  console.info("[Cron] Daily payment jobs + email queue dispatcher registered");
};

export default runDailyJobs;