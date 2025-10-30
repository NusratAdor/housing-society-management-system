// jobs/paymentJobs.js
import cron from "node-cron";
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { sendDueReminderEmail } from "../services/emailService.js";

/**
 * Daily job (runs at 09:00 server time) that:
 * - Sends due reminder 7 days before month end to members with dueAmount > 0.
 * - Optionally adds this month's fee to dueAmount on the 1st (enable via env).
 */

const runDailyJobs = () => {
  // run at 09:00 every day
  cron.schedule("0 9 * * *", async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1..12
      const lastDay = new Date(currentYear, now.getMonth() + 1, 0).getDate();
      const day = now.getDate();

      // 1) Optionally add monthly fee on 1st if enabled
    if (process.env.AUTO_ADD_MONTHLY === "true" && day === 1) {
  const members = await Member.find({});
  for (const m of members) {
    m.dueAmount = (m.dueAmount || 0) + 300;
    m.paymentStatus = m.dueAmount === 0 ? "Paid" : m.dueAmount > 0 ? "Due" : "Pending";

    // create a "Pending" payment entry for the new month
    await Payment.create({
      member: m._id,
      amount: 300,
      month: currentMonth,
      year: currentYear,
      status: "Pending",
      method: "Manual",
      transactionId: `MANUAL-${m._id}-${currentYear}-${currentMonth}`,
    });

    await m.save();
  }
}

      // 2) Send reminders 7 days before month end
      const remindDay = lastDay - 7;
      if (day === remindDay) {
        const membersToRemind = await Member.find({ dueAmount: { $gt: 0 } });
        for (const m of membersToRemind) {
          try {
            // optionally compute months list (not perfect if you don't track unpaid months separately)
            const monthsDue = []; // placeholder; you could compute from payments DB
            await sendDueReminderEmail({
              to: m.email,
              name: m.name,
              dueAmount: m.dueAmount || 0,
              monthsDue,
            });

            await Notification.create({
              type: "Payment",
              content: `Reminder email sent for due amount ৳${(m.dueAmount || 0).toFixed(2)}`,
              clerkUserId: m.clerkUserId,
              adminOnly: false,
            });
          } catch (mailErr) {
            console.error("Reminder email error for", m.email, mailErr);
          }
        }
      }
    } catch (error) {
      console.error("Daily payment job error:", error);
    }
  });
};

export default runDailyJobs;
