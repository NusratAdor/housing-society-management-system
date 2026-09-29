// server/jobs/paymentJobs.js
//
// Daily cron job. Registered once at server startup via runDailyJobs().
//
// Production jobs:
// Task 1 — 1st of month:
//          Create MonthlyCharge for every member at the locked fee.
//
// Task 2 — 9 days before month-end:
//          Queue due reminder emails.
//
// Email dispatcher:
//          Every 5 minutes.
//          Confirmation emails first.
//          Due reminders second.
//
// ---------------------------------------------------------------
// TEMPORARY TEST MODE
// ---------------------------------------------------------------
//
// Set ENABLE_TEST_REMINDER_CRON = true to test the reminder cron.
//
// The test cron:
//
// 1. Runs every minute.
// 2. Runs ONLY ONCE.
// 3. Targets ONLY the three emails listed in
//    TEST_REMINDER_MEMBER_EMAILS.
// 4. Uses their REAL current due balance.
// 5. Creates the normal Notification + EmailQueueItem.
// 6. The normal 5-minute dispatcher sends the email.
//
// IMPORTANT:
// Remove/disable the test section after testing.
//

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
// TEMPORARY TEST CONFIGURATION
// ===============================================================
//
// IMPORTANT:
// Replace these three example emails with the REAL email
// addresses of the three members you want to test.
//
// Example:
//
// const TEST_REMINDER_MEMBER_EMAILS = [
//   "member1@gmail.com",
//   "member2@gmail.com",
//   "member3@gmail.com",
// ];
//

const ENABLE_TEST_REMINDER_CRON = true;

const TEST_REMINDER_MEMBER_EMAILS = [
  "nusratjahan141462@gmail.com",
  "washiflasker1234@gmail.com",
  "washifshazan21@gmail.com",
];


// This prevents the temporary test cron from executing more
// than once during the current server process.
//
// If you restart the server, it can run once again.
let testReminderHasRun = false;


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
    // Mark email as successfully sent
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

    const nextRetryCount = (item.retryCount || 0) + 1;

    const stillRetryable =
      nextRetryCount < MAX_RETRY_ATTEMPTS;

    await EmailQueueItem.updateOne(
      { _id: item._id },
      {
        $set: {
          status: stillRetryable ? "pending" : "failed",
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

export const runMonthlyChargeJob = async (month, year) => {

  const result = await createMonthlyChargesForMonth({
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
      `Monthly maintenance fee of ৳${result.fee.toLocaleString()} ` +
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
//
// Production:
//     queueDueReminders()
//
// This processes ALL active members.
//
// Test:
//     queueDueReminders({
//       memberEmails: [
//         "member1@example.com",
//         "member2@example.com",
//         "member3@example.com"
//       ]
//     })
//
// This processes ONLY those members.
//

export const queueDueReminders = async ({
  memberEmails = null,
} = {}) => {

  // -----------------------------------------------------------
  // Build member query
  // -----------------------------------------------------------

  const memberQuery = {
    status: "active",
  };


  // -----------------------------------------------------------
  // If memberEmails are supplied,
  // only those members will be selected.
  // -----------------------------------------------------------

  if (Array.isArray(memberEmails) && memberEmails.length > 0) {

    memberQuery.email = {
      $in: memberEmails,
    };

  }


  // -----------------------------------------------------------
  // Find members
  // -----------------------------------------------------------

  const members = await Member
    .find(memberQuery)
    .select("_id clerkUserId name email")
    .lean();


  console.info(
    `[Cron] Reminder target members found: ${members.length}`
  );


  // -----------------------------------------------------------
  // Safety log
  // -----------------------------------------------------------

  if (
    Array.isArray(memberEmails) &&
    memberEmails.length > 0
  ) {

    console.info(
      `[TEST CRON] Requested ${memberEmails.length} member(s).`
    );

    console.info(
      `[TEST CRON] Found emails:`,
      members.map((member) => member.email)
    );
  }


  // -----------------------------------------------------------
  // Counters
  // -----------------------------------------------------------

  let reminded = 0;

  let skipped = 0;

  let queueFail = 0;


  // =============================================================
  // PROCESS EACH MEMBER
  // =============================================================

  for (const member of members) {

    console.info(
      `[Cron] Checking due balance for ${member.email}`
    );


    // -----------------------------------------------------------
    // Get REAL current due balance
    // -----------------------------------------------------------

    const breakdown =
      await getMemberDueBreakdown(member._id);


    console.info(
      `[Cron] ${member.email} -> totalDue=৳${breakdown.totalDue}`
    );


    // -----------------------------------------------------------
    // No outstanding amount
    // -----------------------------------------------------------

    if (breakdown.totalDue === 0) {

      console.info(
        `[Cron] ${member.email} is paid. Skipping reminder.`
      );

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
          `Reminder: You have ৳${breakdown.totalDue.toLocaleString()} ` +
          `outstanding. Please pay before month-end.`,

        clerkUserId: member.clerkUserId,

        adminOnly: false,
      });


      console.info(
        `[Cron] Notification created for ${member.email}`
      );

    } catch (notifErr) {

      console.error(
        `[Cron] Notification failed for ${member.email}:`,
        notifErr.message
      );

    }


    // ===========================================================
    // CREATE EMAIL QUEUE ITEM
    // ===========================================================

    try {

      // ---------------------------------------------------------
      // Safety check:
      //
      // Don't create another pending reminder for the same
      // member if one is already waiting to be sent.
      //
      // This is especially useful during testing.
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
      // Add email to queue
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


      console.info(
        `[Cron] Reminder queued successfully for ${member.email}`
      );


    } catch (queueErr) {

      queueFail++;


      console.error(
        `[Cron] Failed to queue reminder for ${member.email}:`,
        queueErr.message
      );

    }

  }


  // =============================================================
  // FINAL RESULT
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
//
// Runs every 5 minutes.
//
// Priority:
//
// 1. Payment confirmations
// 2. Advance confirmations
// 3. Due reminders
//
// Total daily safe limit = 90
// Reminder daily limit   = 70
//

export const runEmailDispatchCycle = async () => {

  // -----------------------------------------------------------
  // How many emails have already been sent today?
  // -----------------------------------------------------------

  const sentSoFar =
    await getSentTodayCount();


  // -----------------------------------------------------------
  // Remaining safe daily capacity
  // -----------------------------------------------------------

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
  // STEP 1
  // PAYMENT CONFIRMATIONS FIRST
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


  // -----------------------------------------------------------
  // Send confirmations
  // -----------------------------------------------------------

  for (const item of pendingConfirmations) {

    const ok =
      await sendQueueItem(item);


    ok
      ? sent++
      : failed++;


    // Small gap between emails
    await new Promise((resolve) =>
      setTimeout(resolve, SEND_GAP_MS)
    );
  }


  // =============================================================
  // STEP 2
  // CALCULATE REMAINING DAILY CAPACITY
  // =============================================================

  const sentAfterConfirmations =
    await getSentTodayCount();


  const remainingAfterConfirmations =
    SAFE_DAILY_CAP - sentAfterConfirmations;


  if (remainingAfterConfirmations <= 0) {

    return {
      sent,
      failed,
      note: "No room left for reminders today",
    };
  }


  // =============================================================
  // STEP 3
  // CHECK REMINDER DAILY LIMIT
  // =============================================================

  const reminderSentToday =
    await getSentTodayCountByType(
      "due_reminder"
    );


  const reminderRoom =
    Math.min(
      REMINDER_DAILY_CAP - reminderSentToday,
      remainingAfterConfirmations
    );


  // =============================================================
  // STEP 4
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


      await new Promise((resolve) =>
        setTimeout(resolve, SEND_GAP_MS)
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


export const recoverStaleProcessingPayments = async () => {

  const cutoff =
    new Date(
      Date.now() -
      STALE_PROCESSING_MINUTES * 60 * 1000
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
      `${result.modifiedCount} stale "processing" payment(s) ` +
      `back to "verified"`
    );
  }


  return result.modifiedCount;
};


// ===============================================================
// CRON REGISTRATION
// ===============================================================

const runDailyJobs = () => {

  // =============================================================
  // PRODUCTION DAILY CRON
  // =============================================================
  //
  // Runs every day at 9:00 AM.
  //
  // IMPORTANT:
  // This is your existing production schedule.
  //

  cron.schedule(
    "0 9 * * *",

    async () => {

      const now =
        new Date();


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
      // MONTHLY CHARGE CREATION
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
      // PRODUCTION DUE REMINDER
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
  // TEMPORARY TEST CRON
  // =============================================================
  //
  // This is ONLY for testing.
  //
  // It runs every minute.
  //
  // BUT:
  //
  // testReminderHasRun prevents it from executing more than once
  // during the current server process.
  //
  // Therefore:
  //
  //     Server starts
  //          ↓
  //     waits for next minute
  //          ↓
  //     tests exactly 3 members
  //          ↓
  //     testReminderHasRun = true
  //          ↓
  //     no more reminder tests
  //

  if (ENABLE_TEST_REMINDER_CRON) {

    cron.schedule(
      "* * * * *",

      async () => {

        // -------------------------------------------------------
        // Prevent second execution
        // -------------------------------------------------------

        if (testReminderHasRun) {
          return;
        }


        // Set this BEFORE running the async job.
        //
        // This protects against overlapping executions.
        testReminderHasRun = true;


        console.info("");
        console.info(
          "================================================"
        );
        console.info(
          "[TEST CRON] Due reminder test started"
        );
        console.info(
          "================================================"
        );


        console.info(
          "[TEST CRON] Target members:"
        );


        TEST_REMINDER_MEMBER_EMAILS.forEach(
          (email, index) => {

            console.info(
              `[TEST CRON] ${index + 1}. ${email}`
            );

          }
        );


        try {

          const result =
            await queueDueReminders({
              memberEmails:
                TEST_REMINDER_MEMBER_EMAILS,
            });


          console.info("");
          console.info(
            "[TEST CRON] Test completed"
          );


          console.info(
            `[TEST CRON] queued=${result.queued}`
          );


          console.info(
            `[TEST CRON] skipped=${result.skipped}`
          );


          console.info(
            `[TEST CRON] queueFail=${result.queueFail}`
          );


          console.info(
            "================================================"
          );
          console.info("");

        } catch (error) {

          console.error(
            "[TEST CRON] Reminder test failed:",
            error.message
          );

        }

      },

      {
        timezone: "Asia/Dhaka",
      }
    );


    console.info(
      "[TEST CRON] Temporary three-member reminder test enabled"
    );

  }


  // =============================================================
  // PRODUCTION EMAIL DISPATCHER
  // =============================================================
  //
  // Runs every 5 minutes.
  //
  // This is NOT modified for the test.
  //
  // The test reminder items will enter the normal queue,
  // and this normal dispatcher will send them.
  //

  cron.schedule(
    "*/5 * * * *",

    async () => {

      // ---------------------------------------------------------
      // Recover stale payments
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
      // Process email queue
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
            `${result.note ? ` (${result.note})` : ""}`
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
  // FINAL REGISTRATION LOG
  // =============================================================

  console.info(
    "[Cron] Daily payment jobs + email queue dispatcher registered"
  );

};


export default runDailyJobs;