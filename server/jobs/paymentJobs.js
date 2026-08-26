// server/jobs/paymentJobs.js
//
// Daily cron job. Registered once at server startup via runDailyJobs().
// Schedule: 09:00 AM server time every day.
//
// Task 1 — 1st of month:
//   Create MonthlyCharge for every member at the locked fee for that month.
//
// Task 2 — 7 days before month-end:
//   Send due reminder emails + in-app notifications to members with dues.
//
// All business logic lives in services — this file orchestrates only.
// Each task is wrapped in its own try/catch so one failure cannot
// prevent the other from running.

import cron                      from "node-cron";
import Member                    from "../models/Member.js";
import Notification              from "../models/Notification.js";
import { createMonthlyChargesForMonth } from "../services/chargeService.js";
import { getMemberDueBreakdown }         from "../services/paymentService.js";
import {
  sendDueReminderEmail,
} from "../services/emailService.js";

import EmailQueueItem from "../models/EmailQueueItem.js";

// ─── runDailyJobs ─────────────────────────────────────────────────────────────

const runDailyJobs = () => {
  // "0 9 * * *" = 09:00 AM every day
  cron.schedule("0 9 * * *", async () => {
    const now            = new Date();
    const currentMonth   = now.getMonth() + 1;
    const currentYear    = now.getFullYear();
    const dayOfMonth     = now.getDate();
    const lastDayOfMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate();

    console.info(
      `[Cron] Daily job — ` +
      `${String(dayOfMonth).padStart(2, "0")}/${String(currentMonth).padStart(2, "0")}/${currentYear}`
    );

    // ── Task 1: 1st of month → create monthly charges ──────────────────────
    if (dayOfMonth === 1) {
      try {
        const result = await createMonthlyChargesForMonth({
          month:       currentMonth,
          year:        currentYear,
          performedBy: "SYSTEM",
        });

        console.info(
          `[Cron] Monthly charges: created=${result.created}, ` +
          `skipped=${result.skipped}, fee=৳${result.fee}`
        );

        // Broadcast in-app notification to all members
        await Notification.create({
          type:        "Payment",
          content:     `Monthly maintenance fee of ৳${result.fee.toLocaleString()} ` +
                       `has been added for ${currentMonth}/${currentYear}. ` +
                       `Please pay before month-end.`,
          clerkUserId: null,   // null = broadcast to all members
          adminOnly:   false,
        });
      } catch (error) {
        console.error("[Cron] Monthly charge creation failed:", error.message);
      }
    }

    // ── Task 2: 7 days before month-end → due reminders ────────────────────
    if (dayOfMonth === lastDayOfMonth - 7) {
      try {
        const members = await Member
          .find({})
          .select("_id clerkUserId name email")
          .lean();

        let reminded  = 0;
        let skipped   = 0;
        let emailFail = 0;

        for (const member of members) {
          // Full breakdown so email includes monthly + extra breakdown
          const breakdown = await getMemberDueBreakdown(member._id);

          if (breakdown.totalDue === 0) {
            skipped++;
            continue;
          }

          // In-app notification
          try {
            await Notification.create({
              type:        "Payment",
              content:
                `Reminder: You have ৳${breakdown.totalDue.toLocaleString()} ` +
                `outstanding. Please pay before month-end.`,
              clerkUserId: member.clerkUserId,
              adminOnly:   false,
            });
          } catch (notifErr) {
            console.error(
              `[Cron] Notification failed for ${member.clerkUserId}:`,
              notifErr.message
            );
          }

                    // Enqueue reminder — NOT sent directly. A separate dispatcher
          // (below) drains this queue within Resend's free-tier daily
          // cap, carrying overflow to the next day instead of risking
          // a rejected/dropped burst.
          try {
            await EmailQueueItem.create({
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
            emailFail++;
            console.error(
              `[Cron] Failed to queue reminder for ${member.email}:`,
              queueErr.message
            );
          }
        }

        console.info(
          `[Cron] Reminders: sent=${reminded}, ` +
          `skipped(paid)=${skipped}, emailFailed=${emailFail}`
        );
      } catch (error) {
        console.error("[Cron] Reminder job failed:", error.message);
      }
    }
  });








  // ─── Daily email queue dispatcher ──────────────────────────────────────────
// Runs every day at a DIFFERENT time than the main job (10:00 AM, one
// hour after the 09:00 job above) so a same-day reminder batch has
// already been enqueued before this runs. Sends up to DAILY_EMAIL_BUDGET
// items — a safety margin below Resend's 100/day free-tier cap, leaving
// headroom for payment-confirmation emails (sent directly, not queued)
// that may also fire on the same day.

const DAILY_EMAIL_BUDGET = 80;

cron.schedule("0 10 * * *", async () => {
  try {
    const pending = await EmailQueueItem
      .find({ status: "pending" })
      .sort({ createdAt: 1 })
      .limit(DAILY_EMAIL_BUDGET)
      .lean();

    if (pending.length === 0) return;

    console.info(`[EmailQueue] Dispatching ${pending.length} queued email(s)`);

    let sent = 0, failed = 0;

    for (const item of pending) {
      try {
        if (item.type === "due_reminder") {
          await sendDueReminderEmail({ to: item.to, ...item.payload });
        }
        await EmailQueueItem.updateOne(
          { _id: item._id },
          { $set: { status: "sent", sentAt: new Date() } }
        );
        sent++;
      } catch (err) {
        await EmailQueueItem.updateOne(
          { _id: item._id },
          { $set: { status: "failed", error: err.message } }
        );
        failed++;
        console.error(`[EmailQueue] Send failed for ${item.to}:`, err.message);
      }
      // 120ms gap — same rate-limit safety margin as before
      await new Promise(r => setTimeout(r, 120));
    }

    console.info(`[EmailQueue] Dispatch complete: sent=${sent}, failed=${failed}`);
  } catch (error) {
    console.error("[EmailQueue] Dispatcher failed:", error.message);
  }
});





  console.info("[Cron] Daily payment jobs registered — runs at 09:00 AM");
};

export default runDailyJobs;