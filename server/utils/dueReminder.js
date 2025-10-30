// utils/dueReminder.js
import cron from "node-cron";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import transporter from "../configs/nodemailer.js";
import { format } from "date-fns";

// Run every day at 9:00 AM
cron.schedule("0 9 * * *", async () => {
  console.log("Running due reminder job...");
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();

    // Last day of current month
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    const reminderDay = lastDayOfMonth - 7; // 7 days before end

    // Only send on the reminder day
    if (today.getDate() !== reminderDay) return;

    const members = await Member.find().select("_id name email paymentStatus");

    for (const member of members) {
      // Count how many months this year were paid
      const paidCount = await Payment.countDocuments({
        member: member._id,
        year: currentYear,
        status: "Paid",
      });

      const dueMonths = currentMonth - paidCount;
      const dueAmount = dueMonths * 300;

      // Auto-update payment status
      let newStatus = "Pending";
      if (dueAmount === 0) newStatus = "Paid";
      else if (dueAmount > 0) newStatus = "Due";

      if (member.paymentStatus !== newStatus) {
        await Member.findByIdAndUpdate(member._id, { paymentStatus: newStatus });
        console.log(`Updated ${member.name}: ${newStatus}`);
      }

      // Send email
      const mailOptions = dueAmount > 0
        ? {
            from: `"Housing Society" <${process.env.SMTP_USER}>`,
            to: member.email,
            subject: `Payment Due: BDT ${dueAmount}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Dear ${member.name},</h2>
                <p>Your monthly membership fee of <strong>BDT 300</strong> is due.</p>
                <p style="font-size: 16px; color: #d32f2f;">
                  <strong>Due Amount: BDT ${dueAmount}</strong> (${dueMonths} month(s))
                </p>
                <p>Please pay before <strong>${format(new Date(currentYear, currentMonth - 1, lastDayOfMonth), "dd MMM yyyy")}</strong>.</p>
                <p>
                  <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Pay Now
                  </a>
                </p>
                <p>Thank you for being a valued member!</p>
                <hr>
                <small>Housing Society Management</small>
              </div>
            `,
          }
        : {
            from: `"Housing Society" <${process.env.SMTP_USER}>`,
            to: member.email,
            subject: "Payment Received – Thank You!",
            html: `
              <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Hi ${member.name},</h2>
                <p>Thank you for paying your monthly fee on time!</p>
                <p>Your account is <strong>up to date</strong>.</p>
                <p>See you next month!</p>
                <hr>
                <small>Housing Society Management</small>
              </div>
            `,
          };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${member.email}`);
    }
  } catch (err) {
    console.error("Due reminder job failed:", err);
  }
});

export default {};