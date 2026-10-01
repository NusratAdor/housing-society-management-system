// server/jobs/paymentJobs.js
//
// Scheduled payment-related jobs for GOMCS.
//
// Responsibilities:
//   1. Create/catch up monthly maintenance charges.
//   2. Create the monthly payment notification once charges are created.
//   3. Queue due-reminder notifications/emails on the configured reminder day.
//   4. Recover abandoned admin-confirmation locks on payments.
//   5. Dispatch queued emails within the configured daily limits.
//
// Architecture:
//   - Business logic stays in services.
//   - This file only orchestrates scheduled work.
//   - Monthly charges are idempotent at the service/database layer.
//   - Email sending is sequential and confirmation-first.
//   - All scheduled jobs run in Asia/Dhaka time.
//
// Current deployment assumption:
//   - Single application instance.
//   - MongoDB is the source of truth.
//   - No Redis/BullMQ/distributed scheduler is required at this scale.
//

import cron from "node-cron";

import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import Notification from "../models/Notification.js";
import EmailQueueItem from "../models/EmailQueueItem.js";

import { createMonthlyChargesForMonth } from "../services/chargeService.js";
import { getMemberDueBreakdown } from "../services/paymentService.js";

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

// ============================================================================
// CONFIGURATION
// ============================================================================

const TIMEZONE = "Asia/Dhaka";

const SAFE_DAILY_CAP = 90;
const REMINDER_DAILY_CAP = 70;

const MAX_RETRY_ATTEMPTS = 3;

// Small delay between provider requests.
// Helps avoid sending a burst of requests in one tight loop.
const SEND_GAP_MS = 120;

// A payment stuck in "processing" beyond this period is treated as
// an abandoned admin-confirmation lock and released back to "verified".
const STALE_PROCESSING_MINUTES = 10;

const CONFIRMATION_TYPES = ["payment_confirmation", "advance_confirmation"];

// Prevents overlapping email-dispatch executions inside this Node process.
//
// This is intentionally in-memory because the current GOMCS deployment
// is designed around a single application instance.
//
// If the application is later scaled to multiple instances, this should
// be replaced with distributed coordination rather than relying on this flag.
let emailDispatchRunning = false;

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Returns the current calendar date in Asia/Dhaka.
 *
 * We do not use:
 *
 *   new Date().getMonth()
 *   new Date().getDate()
 *
 * directly because those getters use the Node process timezone.
 *
 * The cron itself is scheduled in Asia/Dhaka, but the business date
 * should also explicitly come from Asia/Dhaka.
 */
const getDhakaDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

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

/**
 * Returns the number of days in a given month.
 *
 * month is 1-based:
 *   January = 1
 *   December = 12
 */
const getLastDayOfMonth = (year, month) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

// ============================================================================
// EMAIL SENDING
// ============================================================================

/**
 * Sends one queued email and updates its queue state.
 *
 * The item remains "pending" until the actual send succeeds.
 *
 * If sending fails:
 *   attempt 1 -> pending
 *   attempt 2 -> pending
 *   attempt 3 -> failed
 *
 * Keeping failed items in the database makes the queue durable across
 * application restarts.
 */
const sendQueueItem = async (item) => {
  try {
    if (item.type === "payment_confirmation") {
      await sendPaymentConfirmationEmail({
        to: item.to,
        ...item.payload,
      });
    } else if (item.type === "advance_confirmation") {
      await sendAdvancePaymentConfirmationEmail({
        to: item.to,
        ...item.payload,
      });
    } else if (item.type === "due_reminder") {
      await sendDueReminderEmail({
        to: item.to,
        ...item.payload,
      });
    } else {
      throw new Error(`Unsupported email queue type: ${item.type}`);
    }

    await EmailQueueItem.updateOne(
      {
        _id: item._id,
        status: "pending",
      },
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
        },
      },
    );

    return true;
  } catch (error) {
    const nextRetryCount = (item.retryCount || 0) + 1;

    const shouldRetry = nextRetryCount < MAX_RETRY_ATTEMPTS;

    await EmailQueueItem.updateOne(
      {
        _id: item._id,
        status: "pending",
      },
      {
        $set: {
          status: shouldRetry ? "pending" : "failed",
          retryCount: nextRetryCount,
          error: error.message,
        },
      },
    );

    console.error(
      `[EmailQueue] Send failed for ${item.to} ` +
        `(type=${item.type}, attempt=${nextRetryCount}):`,
      error.message,
    );

    return false;
  }
};

// ============================================================================
// MONTHLY CHARGE JOB
// ============================================================================

/**
 * Creates the monthly charges for the specified month/year.
 *
 * The actual charge creation and fee locking are handled by
 * createMonthlyChargesForMonth().
 *
 * This job only orchestrates the service and creates the member-facing
 * notification when at least one charge was actually created.
 */
export const runMonthlyChargeJob = async (month, year) => {
  const result = await createMonthlyChargesForMonth({
    month,
    year,
    performedBy: "SYSTEM",
  });

  console.info(
    `[Cron] Monthly charges: ` +
      `created=${result.created}, ` +
      `skipped=${result.skipped}, ` +
      `fee=৳${result.fee}, ` +
      `month=${month}/${year}`,
  );

  // If nothing was created, this was simply an idempotent/catch-up check.
  //
  // Do not create a notification on every daily cron run.
  if (result.created === 0) {
    return result;
  }

  // --------------------------------------------------------------------------
  // Monthly notification
  // --------------------------------------------------------------------------
  //
  // Because the monthly charge job is intentionally catch-up capable,
  // result.created > 0 can technically happen after the first day.
  //
  // Example:
  //
  // Oct 1 -> 480 charges created
  // Oct 2 -> remaining 20 charges created
  //
  // We therefore also check whether the notification for this exact
  // month already exists.
  //
  // This uses fields already present in the current Notification model
  // usage and does not require introducing another notification system.
  // --------------------------------------------------------------------------

  const content =
    `Monthly charges for ${result.month}/${result.year} have been added. ` +
    `Please check your dashboard.`;

  const existingNotification = await Notification.findOne({
    type: "Payment",
    content,
    clerkUserId: null,
    adminOnly: false,
  }).lean();

  if (!existingNotification) {
    await Notification.create({
      type: "Payment",
      content,
      clerkUserId: null,
      adminOnly: false,
    });

    console.info(
      `[Cron] Monthly payment notification created for ${month}/${year}`,
    );
  } else {
    console.info(
      `[Cron] Monthly payment notification already exists for ${month}/${year}`,
    );
  }

  return result;
};

// ============================================================================
// DUE REMINDERS
// ============================================================================

/**
 * Queues due reminders for all active members who currently have an
 * outstanding balance.
 *
 * Important:
 * - Due amount is calculated from the financial source of truth.
 * - We do not manually inspect Payment.status here.
 * - Only active members receive reminders.
 * - Paid members are skipped.
 */
export const queueDueReminders = async () => {
  const members = await Member.find({
    status: "active",
  })
    .select("_id clerkUserId name email")
    .lean();

  let queued = 0;
  let skipped = 0;
  let queueFailed = 0;

  for (const member of members) {
    try {
      const breakdown = await getMemberDueBreakdown(member._id);

      // No outstanding balance.
      if (breakdown.totalDue === 0) {
        skipped++;
        continue;
      }

      // ---------------------------------------------------------------
      // In-app notification
      // ---------------------------------------------------------------

      try {
        await Notification.create({
          type: "Payment",
          content:
            `Reminder: You have ৳${breakdown.totalDue.toLocaleString()} ` +
            `outstanding. Please pay before month-end.`,
          clerkUserId: member.clerkUserId,
          adminOnly: false,
        });
      } catch (notificationError) {
        // A notification failure should not prevent the email reminder
        // from being queued.
        console.error(
          `[Cron] Notification failed for ${member.clerkUserId}:`,
          notificationError.message,
        );
      }

      // ---------------------------------------------------------------
      // Email queue
      // ---------------------------------------------------------------

      if (member.email) {
        await enqueueEmail({
          to: member.email,
          subject:
            `⏰ Payment Reminder — ` +
            `৳${breakdown.totalDue.toLocaleString()} Due`,
          type: "due_reminder",
          payload: {
            name: member.name,
            totalDue: breakdown.totalDue,
            totalMonthlyDue: breakdown.totalMonthlyDue,
            totalExtraDue: breakdown.totalExtraDue,
            unpaidMonths: breakdown.unpaidMonthlyCharges,
            unpaidCharges: breakdown.unpaidExtraCharges,
          },
        });

        queued++;
      } else {
        console.info(
          `[Cron] Reminder email skipped for member ${member._id}: no email address`,
        );
      }
    } catch (error) {
      queueFailed++;

      console.error(
        `[Cron] Failed to queue reminder for ${member.email}:`,
        error.message,
      );
    }
  }

  console.info(
    `[Cron] Reminders queued: ` +
      `queued=${queued}, ` +
      `skipped(paid)=${skipped}, ` +
      `queueFailed=${queueFailed}`,
  );

  return {
    queued,
    skipped,
    queueFailed,
  };
};

// ============================================================================
// EMAIL QUEUE DISPATCHER
// ============================================================================

/**
 * Sends queued emails while respecting:
 *
 *   Total daily limit:     90
 *   Reminder daily limit:  70
 *
 * Priority:
 *
 *   1. payment_confirmation
 *   2. advance_confirmation
 *   3. due_reminder
 *
 * The function intentionally sends one email at a time.
 *
 * With the current single-server architecture, the in-memory
 * emailDispatchRunning guard prevents two 5-minute executions from
 * processing the same queue simultaneously.
 */
export const runEmailDispatchCycle = async () => {
  if (emailDispatchRunning) {
    return {
      sent: 0,
      failed: 0,
      note: "Previous email dispatch cycle is still running",
    };
  }

  emailDispatchRunning = true;

  try {
    const sentToday = await getSentTodayCount();

    let totalRemaining = SAFE_DAILY_CAP - sentToday;

    if (totalRemaining <= 0) {
      return {
        sent: 0,
        failed: 0,
        note: "Day's safe email budget already used",
      };
    }

    let sent = 0;
    let failed = 0;

    // ------------------------------------------------------------------------
    // 1. PAYMENT CONFIRMATIONS
    // ------------------------------------------------------------------------

    const pendingConfirmations = await EmailQueueItem.find({
      status: "pending",
      type: {
        $in: CONFIRMATION_TYPES,
      },
    })
      .sort({ createdAt: 1 })
      .limit(totalRemaining)
      .lean();

    for (const item of pendingConfirmations) {
      const success = await sendQueueItem(item);

      if (success) {
        sent++;
      } else {
        failed++;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, SEND_GAP_MS);
      });
    }

    // Recalculate from the database rather than relying only on our local
    // counter. This keeps the cap tied to actual successful sends.
    const sentAfterConfirmations = await getSentTodayCount();

    totalRemaining = SAFE_DAILY_CAP - sentAfterConfirmations;

    if (totalRemaining <= 0) {
      return {
        sent,
        failed,
        note: "No room left for reminders today",
      };
    }

    // ------------------------------------------------------------------------
    // 2. DUE REMINDERS
    // ------------------------------------------------------------------------

    const reminderSentToday = await getSentTodayCountByType("due_reminder");

    const reminderRemaining = REMINDER_DAILY_CAP - reminderSentToday;

    const reminderRoom = Math.min(reminderRemaining, totalRemaining);

    if (reminderRoom <= 0) {
      return {
        sent,
        failed,
        note: "Reminder daily cap already used",
      };
    }

    const pendingReminders = await EmailQueueItem.find({
      status: "pending",
      type: "due_reminder",
    })
      .sort({ createdAt: 1 })
      .limit(reminderRoom)
      .lean();

    for (const item of pendingReminders) {
      const success = await sendQueueItem(item);

      if (success) {
        sent++;
      } else {
        failed++;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, SEND_GAP_MS);
      });
    }

    return {
      sent,
      failed,
    };
  } finally {
    emailDispatchRunning = false;
  }
};

// ============================================================================
// STALE PAYMENT RECOVERY
// ============================================================================

/**
 * Releases abandoned admin-confirmation locks.
 *
 * Payment lifecycle:
 *
 *   pending
 *      ↓
 *   verified
 *      ↓
 *   processing       <-- admin has claimed the payment
 *      ↓
 *   completed
 *
 * If an admin claims a payment but the request/process dies before
 * confirmation finishes, the payment can remain "processing".
 *
 * After the configured timeout we safely return it to "verified",
 * which means:
 *
 *   gateway already verified the payment
 *   AND
 *   admin confirmation is still required
 *
 * We do NOT return it to "pending", because the gateway has already
 * confirmed it.
 */
export const recoverStaleProcessingPayments = async () => {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000);

  const result = await Payment.updateMany(
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
    },
  );

  if (result.modifiedCount > 0) {
    console.warn(
      `[Payments] Released ${result.modifiedCount} stale ` +
        `"processing" payment(s) back to "verified"`,
    );
  }

  return result.modifiedCount;
};

// ============================================================================
// CRON REGISTRATION
// ============================================================================

const runDailyJobs = () => {
  // ==========================================================================
  // DAILY PAYMENT JOB
  // ==========================================================================
  //
  // Runs every day at 9:00 AM Bangladesh time.
  //
  // Monthly charges intentionally run every day.
  //
  // Why?
  //
  // If the server is unavailable on October 1:
  //
  //   October 1 -> job missed
  //   October 2 -> job runs
  //              -> missing October charges are created
  //
  // createMonthlyChargesForMonth() is responsible for idempotency.
  //
  // The unique member/month/year constraint remains the final database
  // protection against duplicate MonthlyCharge records.
  // ==========================================================================

  cron.schedule(
    "0 9 * * *",
    async () => {
      const { year, month, day } = getDhakaDateParts();

      const lastDayOfMonth = getLastDayOfMonth(year, month);

      console.info(
        `[Cron] Daily payment job — ` +
          `${String(day).padStart(2, "0")}/` +
          `${String(month).padStart(2, "0")}/` +
          `${year}`,
      );

      // ----------------------------------------------------------------------
      // Monthly charge creation / catch-up
      // ----------------------------------------------------------------------

      try {
        await runMonthlyChargeJob(month, year);
      } catch (error) {
        console.error("[Cron] Monthly charge job failed:", error.message);
      }

      // ----------------------------------------------------------------------
      // Due reminder
      // ----------------------------------------------------------------------
      //
      // Example:
      //
      // 31-day month:
      //   lastDay = 31
      //   reminder day = 22
      //
      // 30-day month:
      //   lastDay = 30
      //   reminder day = 21
      //
      // February:
      //   calculated automatically.
      //
      // The reminder remains tied to the intended calendar date.
      // ----------------------------------------------------------------------

      const reminderDay = lastDayOfMonth - 9;

      if (day === reminderDay) {
        try {
          await queueDueReminders();
        } catch (error) {
          console.error("[Cron] Reminder job failed:", error.message);
        }
      }
    },
    {
      timezone: TIMEZONE,
    },
  );

  // ==========================================================================
  // FIVE-MINUTE MAINTENANCE / EMAIL DISPATCHER
  // ==========================================================================
  //
  // Every five minutes:
  //
  //   1. Recover abandoned payment-confirmation locks.
  //   2. Dispatch payment confirmations.
  //   3. Dispatch advance-payment confirmations.
  //   4. Dispatch due reminders.
  //
  // Confirmations always get priority over reminders.
  // ==========================================================================

  cron.schedule(
    "*/5 * * * *",
    async () => {
      // ----------------------------------------------------------------------
      // Recover stale payment locks
      // ----------------------------------------------------------------------

      try {
        await recoverStaleProcessingPayments();
      } catch (error) {
        console.error(
          "[Payments] Stale-processing recovery failed:",
          error.message,
        );
      }

      // ----------------------------------------------------------------------
      // Dispatch email queue
      // ----------------------------------------------------------------------

      try {
        const result = await runEmailDispatchCycle();

        if (result.sent > 0 || result.failed > 0 || result.note) {
          console.info(
            `[EmailQueue] Dispatch run: ` +
              `sent=${result.sent}, ` +
              `failed=${result.failed}` +
              (result.note ? ` (${result.note})` : ""),
          );
        }
      } catch (error) {
        console.error("[EmailQueue] Dispatcher failed:", error.message);
      }
    },
    {
      timezone: TIMEZONE,
    },
  );

  // ==========================================================================
  // REGISTRATION LOG
  // ==========================================================================

  console.info("[Cron] Payment jobs + email queue dispatcher registered");
};

export default runDailyJobs;
