// server/jobs/paymentJobs.js

// Daily cron job. Registered once at server startup via runDailyJobs.
//
// Task 1 — 1st of month:
//          Create MonthlyCharge for every member at the
//          locked fee for that month.
//
// Task 2 — 9 days before month-end:
//          Queue due reminder emails.
//
// Email dispatcher — every 5 min:
//          Confirmations first.
//          Reminders second.
//          Both share one safe daily budget.

import cron from "node-cron";

import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import Notification from "../models/Notification.js";
import EmailQueueItem from "../models/EmailQueueItem.js";

import {
  createMonthlyChargesForMonth,
} from "../services/chargeService.js";

import {
  getMemberDueBreakdown,
} from "../services/paymentService.js";

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


// ===============================================================
// EMAIL LIMITS
// ===============================================================

const SAFE_DAILY_CAP = 90;

const REMINDER_DAILY_CAP = 70;

const MAX_RETRY_ATTEMPTS = 3;

const SEND_GAP_MS = 120;

const CONFIRMATION_TYPES = [
  "payment_confirmation",
  "advance_confirmation",
];


// ===============================================================
// SEND ONE EMAIL QUEUE ITEM
// ===============================================================

const sendQueueItem = async (item) => {
  try {

    // -----------------------------------------------------------
    // Payment confirmation
    // -----------------------------------------------------------

    if (item.type === "payment_confirmation") {

      await sendPaymentConfirmationEmail({
        to: item.to,
        ...item.payload,
      });

    }

    // -----------------------------------------------------------
    // Advance payment confirmation
    // -----------------------------------------------------------

    else if (item.type === "advance_confirmation") {

      await sendAdvancePaymentConfirmationEmail({
        to: item.to,
        ...item.payload,
      });

    }

    // -----------------------------------------------------------
    // Due reminder
    // -----------------------------------------------------------

    else if (item.type === "due_reminder") {

      await sendDueReminderEmail({
        to: item.to,
        ...item.payload,
      });

    }


    // -----------------------------------------------------------
    // Mark email as sent
    // -----------------------------------------------------------

    await EmailQueueItem.updateOne(
      { _id: item._id },
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
        },
      }
    );


    return true;


  } catch (err) {

    // -----------------------------------------------------------
    // Retry handling
    // -----------------------------------------------------------

    const nextRetryCount =
      (item.retryCount || 0) + 1;

    const stillRetryable =
      nextRetryCount < MAX_RETRY_ATTEMPTS;


    await EmailQueueItem.updateOne(
      { _id: item._id },
      {
        $set: {
          status: stillRetryable
            ? "pending"
            : "failed",

          retryCount: nextRetryCount,

          error: err.message,
        },
      }
    );


    console.error(
      `[EmailQueue] Send failed for ${item.to} ` +
      `(type: ${item.type}, attempt ${nextRetryCount}):`,
      err.message
    );


    return false;
  }
};


// ===============================================================
// MONTHLY CHARGE JOB
// ===============================================================

export const runMonthlyChargeJob = async (
  month,
  year
) => {

  const result =
    await createMonthlyChargesForMonth({
      month,
      year,
      performedBy: "SYSTEM",
    });


  console.info(
    `[Cron] Monthly charges: created=${result.created}, ` +
    `skipped=${result.skipped}, fee=৳${result.fee}`
  );


  await Notification.create({

    type: "Payment",

    content:
      `Monthly maintenance fee of ` +
      `৳${result.fee.toLocaleString()} ` +
      `has been added for ${month}/${year}. ` +
      `Please pay before month-end.`,

    clerkUserId: null,

    adminOnly: false,

  });


  return result;
};


// ===============================================================
// QUEUE DUE REMINDERS
// ===============================================================

export const queueDueReminders = async () => {

  const members =
    await Member
      .find({
        status: "active",
      })
      .select("_id clerkUserId name email")
      .lean();


  let reminded = 0;

  let skipped = 0;

  let queueFail = 0;


  // =============================================================
  // PROCESS MEMBERS
  // =============================================================

  for (const member of members) {

    const breakdown =
      await getMemberDueBreakdown(
        member._id
      );


    // -----------------------------------------------------------
    // Member has no outstanding balance
    // -----------------------------------------------------------

    if (breakdown.totalDue === 0) {

      skipped++;

      continue;
    }


    // ===========================================================
    // CREATE IN-APP NOTIFICATION
    // ===========================================================

    try {

      await Notification.create({

        type: "Payment",

        content:
          `Reminder: You have ` +
          `৳${breakdown.totalDue.toLocaleString()} ` +
          `outstanding. Please pay before month-end.`,

        clerkUserId:
          member.clerkUserId,

        adminOnly: false,

      });

    } catch (notifErr) {

      console.error(
        `[Cron] Notification failed for ` +
        `${member.clerkUserId}:`,
        notifErr.message
      );

    }


    // ===========================================================
    // CREATE EMAIL QUEUE ITEM
    // ===========================================================

    try {

      // ---------------------------------------------------------
      // Prevent duplicate pending reminder emails
      // ---------------------------------------------------------

      const existingPendingReminder =
        await EmailQueueItem.findOne({

          to: member.email,

          type: "due_reminder",

          status: "pending",

        }).lean();


      if (existingPendingReminder) {

        console.warn(
          `[Cron] Pending reminder already exists for ` +
          `${member.email}. Skipping duplicate queue item.`
        );

        skipped++;

        continue;
      }


      // ---------------------------------------------------------
      // Queue reminder email
      // ---------------------------------------------------------

      await enqueueEmail({

        to: member.email,

        subject:
          `⏰ Payment Reminder — ` +
          `৳${breakdown.totalDue.toLocaleString()} Due`,

        type: "due_reminder",

        payload: {

          name: member.name,

          totalDue:
            breakdown.totalDue,

          totalMonthlyDue:
            breakdown.totalMonthlyDue,

          totalExtraDue:
            breakdown.totalExtraDue,

          unpaidMonths:
            breakdown.unpaidMonthlyCharges,

          unpaidCharges:
            breakdown.unpaidExtraCharges,

        },

      });


      reminded++;


    } catch (queueErr) {

      queueFail++;


      console.error(
        `[Cron] Failed to queue reminder for ` +
        `${member.email}:`,
        queueErr.message
      );

    }

  }


  // =============================================================
  // FINAL LOG
  // =============================================================

  console.info(
    `[Cron] Reminders queued: ` +
    `queued=${reminded}, ` +
    `skipped(paid/already queued)=${skipped}, ` +
    `queueFailed=${queueFail}`
  );


  return {
    queued: reminded,
    skipped,
    queueFail,
  };
};


// ===============================================================
// EMAIL DISPATCHER
// ===============================================================

export const runEmailDispatchCycle = async () => {

  // -----------------------------------------------------------
  // Total emails already sent today
  // -----------------------------------------------------------

  const sentSoFar =
    await getSentTodayCount();


  const totalRemaining =
    SAFE_DAILY_CAP - sentSoFar;


  if (totalRemaining <= 0) {

    return {
      sent: 0,
      failed: 0,
      note: "Day's safe budget already used",
    };
  }


  // =============================================================
  // CONFIRMATION EMAILS FIRST
  // =============================================================

  const pendingConfirmations =
    await EmailQueueItem
      .find({
        status: "pending",

        type: {
          $in: CONFIRMATION_TYPES,
        },
      })
      .sort({
        createdAt: 1,
      })
      .limit(totalRemaining)
      .lean();


  let sent = 0;

  let failed = 0;


  for (const item of pendingConfirmations) {

    const ok =
      await sendQueueItem(item);


    ok
      ? sent++
      : failed++;


    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          SEND_GAP_MS
        )
    );

  }


  // =============================================================
  // REMAINING DAILY CAPACITY
  // =============================================================

  const sentAfterConfirmations =
    await getSentTodayCount();


  const remainingAfterConfirmations =
    SAFE_DAILY_CAP -
    sentAfterConfirmations;


  if (remainingAfterConfirmations <= 0) {

    return {
      sent,
      failed,
      note: "No room left for reminders today",
    };
  }


  // =============================================================
  // REMINDER DAILY CAP
  // =============================================================

  const reminderSentToday =
    await getSentTodayCountByType(
      "due_reminder"
    );


  const reminderRoom =
    Math.min(
      REMINDER_DAILY_CAP -
        reminderSentToday,

      remainingAfterConfirmations
    );


  // =============================================================
  // SEND REMINDERS
  // =============================================================

  if (reminderRoom > 0) {

    const pendingReminders =
      await EmailQueueItem
        .find({
          status: "pending",

          type: "due_reminder",
        })
        .sort({
          createdAt: 1,
        })
        .limit(reminderRoom)
        .lean();


    for (const item of pendingReminders) {

      const ok =
        await sendQueueItem(item);


      ok
        ? sent++
        : failed++;


      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            SEND_GAP_MS
          )
      );

    }
  }


  return {
    sent,
    failed,
  };
};


// ===============================================================
// STALE PROCESSING PAYMENT RECOVERY
// ===============================================================

const STALE_PROCESSING_MINUTES = 10;


export const recoverStaleProcessingPayments =
  async () => {

    const cutoff =
      new Date(
        Date.now() -
        STALE_PROCESSING_MINUTES *
          60 *
          1000
      );


    const result =
      await Payment.updateMany(

        {
          status: "processing",

          processingAt: {
            $lt: cutoff,
          },
        },

        {
          $set: {
            status: "verified",
          },

          $unset: {
            processingAt: "",
          },
        }

      );


    if (result.modifiedCount > 0) {

      console.warn(
        `[Payments] Released ` +
        `${result.modifiedCount} stale ` +
        `"processing" payment(s) ` +
        `back to "verified"`
      );

    }


    return result.modifiedCount;
  };


// ===============================================================
// REGISTER CRON JOBS
// ===============================================================

const runDailyJobs = () => {

  // =============================================================
  // DAILY PAYMENT JOB
  // =============================================================
  //
  // Runs every day at 9:00 AM Bangladesh time.
  //

  cron.schedule(
    "0 9 * * *",

    async () => {

      const now = new Date();


      const currentMonth =
        now.getMonth() + 1;


      const currentYear =
        now.getFullYear();


      const dayOfMonth =
        now.getDate();


      const lastDayOfMonth =
        new Date(
          currentYear,
          now.getMonth() + 1,
          0
        ).getDate();


      console.info(
        `[Cron] Daily job — ` +
        `${String(dayOfMonth).padStart(2, "0")}/` +
        `${String(currentMonth).padStart(2, "0")}/` +
        `${currentYear}`
      );


      // =========================================================
      // FIRST DAY OF MONTH
      // =========================================================

      if (dayOfMonth === 1) {

        try {

          await runMonthlyChargeJob(
            currentMonth,
            currentYear
          );

        } catch (error) {

          console.error(
            "[Cron] Monthly charge creation failed:",
            error.message
          );

        }

      }


      // =========================================================
      // DUE REMINDER
      // =========================================================

      if (
        dayOfMonth ===
        lastDayOfMonth - 9
      ) {

        try {

          await queueDueReminders();

        } catch (error) {

          console.error(
            "[Cron] Reminder job failed:",
            error.message
          );

        }

      }

    },

    {
      timezone: "Asia/Dhaka",
    }

  );


  // =============================================================
  // EMAIL QUEUE DISPATCHER
  // =============================================================
  //
  // Runs every 5 minutes.
  //

  cron.schedule(
    "*/5 * * * *",

    async () => {

      // ---------------------------------------------------------
      // Recover stale processing payments
      // ---------------------------------------------------------

      try {

        await recoverStaleProcessingPayments();

      } catch (error) {

        console.error(
          "[Payments] Stale-processing recovery failed:",
          error.message
        );

      }


      // ---------------------------------------------------------
      // Dispatch emails
      // ---------------------------------------------------------

      try {

        const result =
          await runEmailDispatchCycle();


        if (
          result.sent > 0 ||
          result.failed > 0
        ) {

          console.info(
            `[EmailQueue] Dispatch run: ` +
            `sent=${result.sent}, ` +
            `failed=${result.failed}` +
            `${
              result.note
                ? ` (${result.note})`
                : ""
            }`
          );

        }

      } catch (error) {

        console.error(
          "[EmailQueue] Dispatcher failed:",
          error.message
        );

      }

    },

    {
      timezone: "Asia/Dhaka",
    }

  );


  // =============================================================
  // REGISTRATION LOG
  // =============================================================

  console.info(
    "[Cron] Daily payment jobs + email queue dispatcher registered"
  );

};


export default runDailyJobs;