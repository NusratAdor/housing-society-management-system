// services/emailService.js
import transporter from "../configs/nodemailer.js";
 // adjust path to your transporter file

const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com";

export const sendDueReminderEmail = async ({ to, name, dueAmount, monthsDue }) => {
  const subject = "Payment Reminder — Housing Society";
  const html = `
    <div style="font-family: Inter, system-ui, Arial; color: #111;">
      <h2 style="color:#0B5FFF;">Dear ${name || "Member"},</h2>
      <p>This is a friendly reminder that your outstanding membership fee is <strong>৳${dueAmount.toFixed(2)}</strong>.</p>
      ${monthsDue ? `<p>Unpaid months: ${monthsDue.join(", ")}</p>` : ""}
      <p>Please pay within the current month to avoid penalties. Monthly fee: <strong>৳300</strong>.</p>
      <p><a href="${process.env.FRONTEND_URL || "#"}" style="background:#0b5fff;color:white;padding:8px 12px;border-radius:6px;text-decoration:none;">Pay Now</a></p>
      <p style="color:#666;font-size:13px;">You will receive this reminder 7 days before the current month ends if dues remain unpaid.</p>
      <hr />
      <small>Regards,<br/>Housing Society</small>
    </div>
  `;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
  return info;
};

export const sendPaymentSuccessEmail = async ({ to, name, month, year, amount }) => {
  const subject = "Payment Received — Thank you!";
  const html = `
    <div style="font-family: Inter, system-ui, Arial; color: #111;">
      <h2 style="color:#0B5FFF;">Dear ${name || "Member"},</h2>
      <p>We have received your payment of <strong>৳${Number(amount).toFixed(2)}</strong> for <strong>${month}/${year}</strong>.</p>
      <p>Thank you! Your account has been updated.</p>
      <p style="color:#666;font-size:13px;">If you think this is a mistake, contact the admin.</p>
      <hr />
      <small>Regards,<br/>Housing Society</small>
    </div>
  `;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
  return info;
};
