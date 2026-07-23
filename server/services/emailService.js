// server/services/emailService.js
//
// Single email provider: Resend.
//
// CHANGE (this pass): sendPaymentConfirmationEmail now accepts optional
// advanceAmount / creditBalance params. When advanceAmount > 0, the
// receipt shows a "Added to Credit Balance" / "Your Credit Balance"
// section alongside the normal breakdown — since one payment can now be
// partly charges, partly credit, this replaced the earlier separate
// sendAdvancePaymentConfirmationEmail function entirely.

import { Resend }        from "resend";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import ExtraCharge       from "../models/ExtraCharge.js";

const resend      = new Resend(process.env.RESEND_API_KEY);
const FROM        = process.env.FROM_EMAIL
  ? `GOHS <${process.env.FROM_EMAIL}>`
  : "GOHS <noreply@gohs.example.com>";
const FRONTEND    = process.env.FRONTEND_URL || "https://yourdomain.com";
const SOCIETY     = "Government Officer's Housing Society";
const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n) => Number(n).toLocaleString();
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[Email] RESEND_API_KEY not set — skipped email to ${to}`);
    return { skipped: true };
  }

  const result = await resend.emails.send({
    from:    FROM,
    to:      Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result;
};

const emailLayout = ({ title, preheader, bodyContent }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
             font-family:'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;
              color:#f1f5f9;font-size:1px;">
    ${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;">

        <tr>
          <td style="background:#064e3b;padding:28px 40px;
                     border-radius:12px 12px 0 0;text-align:center;">
            <p style="margin:0;color:#6ee7b7;font-size:11px;
                      letter-spacing:2px;text-transform:uppercase;
                      font-weight:600;">
              ${SOCIETY}
            </p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;
                        font-weight:700;letter-spacing:-0.3px;">
              ${title}
            </h1>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:36px 40px;
                     border-radius:0 0 12px 12px;
                     box-shadow:0 2px 16px rgba(0,0,0,0.06);">
            ${bodyContent}
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              © ${new Date().getFullYear()} ${SOCIETY}<br/>
              This is an automated message — please do not reply directly.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const chargeRow = ({ description, subtext, amount, isBold = false }) => `
  <tr>
    <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;
               font-size:14px;color:#374151;line-height:1.5;">
      ${description}
      ${subtext
        ? `<br/><span style="font-size:12px;color:#9ca3af;">${subtext}</span>`
        : ""}
    </td>
    <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;
               font-size:14px;text-align:right;white-space:nowrap;
               font-weight:${isBold ? "700" : "400"};
               color:${isBold ? "#111827" : "#374151"};">
      ৳${fmt(amount)}
    </td>
  </tr>
`;

const totalRow = ({ label, amount, color = "#065f46" }) => `
  <tr style="background:#f0fdf4;">
    <td style="padding:14px 16px;font-weight:700;font-size:15px;color:${color};">
      ${label}
    </td>
    <td style="padding:14px 16px;text-align:right;font-weight:800;
               font-size:16px;color:${color};white-space:nowrap;">
      ৳${fmt(amount)}
    </td>
  </tr>
`;

/**
 * sendPaymentConfirmationEmail
 * Sent after an admin confirms a gateway-verified payment.
 *
 * @param {Array}  allocations   — PaymentAllocation records for the
 *                                 charges portion of this payment
 * @param {number} remainingDue  — member's total outstanding balance
 *                                 across their account AFTER this payment
 * @param {number} [advanceAmount] — the portion of this payment banked as
 *                                   credit (0 for an ordinary payment)
 * @param {number} [creditBalance] — member's total unapplied credit AFTER
 *                                    this payment, only meaningful when
 *                                    advanceAmount > 0
 *
 * Called from: adminPaymentController.approvePayment — the only call site.
 */
export const sendPaymentConfirmationEmail = async ({
  to,
  name,
  amount,
  receiptNumber,
  paidAt,
  allocations   = [],
  remainingDue  = 0,
  advanceAmount = 0,
  creditBalance = 0,
}) => {
  const monthlyAllocations = allocations.filter(a => a.chargeType === "monthly");
  const extraAllocations   = allocations.filter(a => a.chargeType === "extra");

  const monthlyChargeIds = monthlyAllocations.map(a => a.chargeId);
  const extraChargeIds   = extraAllocations.map(a => a.chargeId);

  const [monthlyMeta, extraMeta] = await Promise.all([
    monthlyChargeIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyChargeIds } }).select("month year").lean()
      : [],
    extraChargeIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraChargeIds } }).select("label purpose").lean()
      : [],
  ]);

  const monthlyMetaMap = Object.fromEntries(monthlyMeta.map(c => [String(c._id), c]));
  const extraMetaMap   = Object.fromEntries(extraMeta.map(c => [String(c._id), c]));

  const monthlyRowsBuilt = monthlyAllocations
    .map(a => {
      const meta = monthlyMetaMap[String(a.chargeId)];
      return meta ? { month: meta.month, year: meta.year, amount: a.amount } : null;
    })
    .filter(Boolean)
    .sort((x, y) => (x.year !== y.year ? x.year - y.year : x.month - y.month));

  const extraRowsBuilt = extraAllocations
    .map(a => {
      const meta = extraMetaMap[String(a.chargeId)];
      return meta ? { label: meta.label, purpose: meta.purpose, amount: a.amount } : null;
    })
    .filter(Boolean);

  const hasBreakdown = monthlyRowsBuilt.length > 0 || extraRowsBuilt.length > 0;

  const breakdownRows = hasBreakdown ? [
    ...monthlyRowsBuilt.map(m =>
      chargeRow({
        description: `Monthly Maintenance — ${MONTH_NAMES[m.month]} ${m.year}`,
        amount:      m.amount,
      })
    ),
    ...extraRowsBuilt.map(c =>
      chargeRow({
        description: c.label,
        subtext:     c.purpose,
        amount:      c.amount,
      })
    ),
    totalRow({ label: "Total Applied to Dues", amount: amount - advanceAmount }),
  ].join("") : "";

  const isFullyCleared = remainingDue <= 0;

  const introText = isFullyCleared
    ? `We have received your payment of <strong style="color:#111827;">৳${fmt(amount)}</strong> on ${fmtDate(paidAt)}. Your account has been updated and your dues are fully cleared.`
    : `We have received your payment of <strong style="color:#111827;">৳${fmt(amount)}</strong> on ${fmtDate(paidAt)}. Your account has been updated accordingly.`;

  const remainingBalanceBlock = !isFullyCleared ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fde68a;border-radius:10px;
                  overflow:hidden;margin-bottom:24px;background:#fffbeb;">
      <tr>
        <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#92400e;">
          Remaining Outstanding Balance
        </td>
        <td style="padding:14px 20px;text-align:right;font-size:16px;
                   font-weight:800;color:#b45309;white-space:nowrap;">
          ৳${fmt(remainingDue)}
        </td>
      </tr>
    </table>
  ` : "";

  const creditBlock = advanceAmount > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #bbf7d0;border-radius:10px;
                  overflow:hidden;margin-bottom:24px;background:#f0fdf4;">
      <tr>
        <td style="padding:12px 20px;font-size:13px;color:#065f46;
                   border-bottom:1px solid #bbf7d0;">
          Added to Credit Balance
        </td>
        <td style="padding:12px 20px;text-align:right;font-size:14px;
                   font-weight:700;color:#059669;white-space:nowrap;
                   border-bottom:1px solid #bbf7d0;">
          ৳${fmt(advanceAmount)}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;font-size:13px;font-weight:600;color:#065f46;">
          Your Credit Balance
        </td>
        <td style="padding:12px 20px;text-align:right;font-size:16px;
                   font-weight:800;color:#059669;white-space:nowrap;">
          ৳${fmt(creditBalance)}
        </td>
      </tr>
    </table>
  ` : "";

  const bodyContent = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;
                  width:64px;height:64px;line-height:64px;font-size:32px;">
        ✅
      </div>
      <p style="margin:12px 0 0;font-size:22px;font-weight:700;color:#064e3b;">
        Payment Confirmed
      </p>
      <p style="margin:4px 0 0;font-size:14px;color:#059669;">
        Your payment has been successfully processed
      </p>
    </div>

    <p style="font-size:15px;color:#374151;margin:0 0 20px;">
      Dear <strong>${name}</strong>,
    </p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.7;">
      ${introText}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border:1px solid #e2e8f0;
                  border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:12px 20px;font-size:13px;color:#64748b;
                   border-bottom:1px solid #e2e8f0;">
          Receipt Number
        </td>
        <td style="padding:12px 20px;font-size:14px;font-weight:700;
                   font-family:monospace;color:#1e293b;text-align:right;
                   border-bottom:1px solid #e2e8f0;">
          ${receiptNumber}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;font-size:13px;color:#64748b;">
          Payment Date
        </td>
        <td style="padding:12px 20px;font-size:14px;color:#1e293b;
                   text-align:right;">
          ${fmtDate(paidAt)}
        </td>
      </tr>
    </table>

    ${hasBreakdown ? `
      <p style="font-size:13px;font-weight:600;color:#374151;
                text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;">
        Payment Breakdown
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e5e7eb;border-radius:10px;
                    overflow:hidden;margin-bottom:20px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 16px;text-align:left;font-size:11px;
                       font-weight:600;color:#9ca3af;text-transform:uppercase;
                       letter-spacing:0.5px;">
              Description
            </th>
            <th style="padding:10px 16px;text-align:right;font-size:11px;
                       font-weight:600;color:#9ca3af;text-transform:uppercase;
                       letter-spacing:0.5px;">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>${breakdownRows}</tbody>
      </table>
    ` : ""}

    ${creditBlock}
    ${remainingBalanceBlock}

    <div style="text-align:center;margin-top:8px;">
      <a href="${FRONTEND}/dashboard"
         style="display:inline-block;background:#064e3b;color:#ffffff;
                padding:14px 36px;border-radius:8px;font-size:14px;
                font-weight:600;text-decoration:none;letter-spacing:0.2px;">
        View Dashboard
      </a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Payment Confirmed — Receipt ${receiptNumber}`,
    html: emailLayout({
      title:      "Payment Confirmed",
      preheader:  `৳${fmt(amount)} received · Receipt ${receiptNumber}`,
      bodyContent,
    }),
  });
};

/**
 * sendDueReminderEmail — UNCHANGED
 */
export const sendDueReminderEmail = async ({
  to,
  name,
  totalDue,
  totalMonthlyDue,
  totalExtraDue,
  unpaidMonths  = [],
  unpaidCharges = [],
}) => {
  const monthlyRows = unpaidMonths.map(m =>
    chargeRow({
      description: `Monthly Maintenance — ${MONTH_NAMES[m.month]} ${m.year}`,
      amount:      m.amount,
    })
  ).join("");

  const extraRows = unpaidCharges.map(c =>
    chargeRow({
      description: c.label,
      subtext:     c.purpose,
      amount:      c.amount,
    })
  ).join("");

  const hasMonthly = unpaidMonths.length > 0;
  const hasExtra   = unpaidCharges.length > 0;

  const bodyContent = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#fef9c3;border-radius:50%;
                  width:64px;height:64px;line-height:64px;font-size:32px;">
        ⏰
      </div>
      <p style="margin:12px 0 0;font-size:20px;font-weight:700;color:#854d0e;">
        Payment Reminder
      </p>
      <p style="margin:4px 0 0;font-size:14px;color:#a16207;">
        Please clear your dues before month-end
      </p>
    </div>

    <p style="font-size:15px;color:#374151;margin:0 0 16px;">
      Dear <strong>${name}</strong>,
    </p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.7;">
      This is a friendly reminder that you have outstanding dues of
      <strong style="font-size:18px;color:#dc2626;">৳${fmt(totalDue)}</strong>
      that should be cleared before the end of this month.
    </p>

    ${hasMonthly ? `
      <p style="font-size:13px;font-weight:600;color:#374151;
                text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">
        Monthly Dues
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #fde68a;border-radius:10px;
                    overflow:hidden;margin-bottom:20px;background:#fffbeb;">
        <tbody>
          ${monthlyRows}
          ${totalRow({ label: "Monthly Total", amount: totalMonthlyDue, color: "#92400e" })}
        </tbody>
      </table>
    ` : ""}

    ${hasExtra ? `
      <p style="font-size:13px;font-weight:600;color:#374151;
                text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">
        Additional Charges
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #fde68a;border-radius:10px;
                    overflow:hidden;margin-bottom:20px;background:#fffbeb;">
        <tbody>
          ${extraRows}
          ${totalRow({ label: "Charges Total", amount: totalExtraDue, color: "#92400e" })}
        </tbody>
      </table>
    ` : ""}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:2px solid #dc2626;border-radius:10px;
                  overflow:hidden;margin-bottom:28px;">
      <tr style="background:#fee2e2;">
        <td style="padding:16px 20px;font-size:16px;font-weight:700;color:#991b1b;">
          Total Outstanding
        </td>
        <td style="padding:16px 20px;text-align:right;font-size:20px;
                   font-weight:800;color:#dc2626;white-space:nowrap;">
          ৳${fmt(totalDue)}
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      <a href="${FRONTEND}/dashboard"
         style="display:inline-block;background:#dc2626;color:#ffffff;
                padding:14px 40px;border-radius:8px;font-size:15px;
                font-weight:700;text-decoration:none;">
        Pay Now
      </a>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">
        You will receive this reminder 7 days before month-end
        while dues remain outstanding.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `⏰ Payment Reminder — ৳${fmt(totalDue)} Due`,
    html: emailLayout({
      title:      "Payment Reminder",
      preheader:  `You have ৳${fmt(totalDue)} outstanding. Please pay before month-end.`,
      bodyContent,
    }),
  });
};

/**
 * sendNoticeEmail — UNCHANGED
 */
export const sendNoticeEmail = async (to, notice) => {
  const { title, date, summary, content, image } = notice;

  const optimisedImage = image
    ? image
        .replace("http://", "https://")
        .replace("/upload/", "/upload/q_auto,f_auto,w_800,c_limit/")
    : null;

  const bodyContent = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#1e293b;">
      ${title}
    </h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">
      ${date ? fmtDate(date) : ""}
    </p>

    ${optimisedImage ? `
      <img src="${optimisedImage}" alt="${title}"
           width="520" style="max-width:100%;height:auto;border-radius:10px;
                              display:block;margin:0 0 20px;" />
    ` : ""}

    ${summary ? `
      <div style="background:#f0fdf4;border-left:3px solid #10b981;
                  padding:12px 16px;border-radius:0 6px 6px 0;margin:0 0 20px;">
        <p style="margin:0;font-size:15px;font-weight:500;color:#065f46;
                  line-height:1.6;">
          ${summary}
        </p>
      </div>
    ` : ""}

    <div style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 28px;">
      ${content.replace(/\n/g, "<br/>")}
    </div>

    <div style="text-align:center;">
      <a href="${FRONTEND}/notices"
         style="display:inline-block;background:#10b981;color:#ffffff;
                padding:12px 32px;border-radius:8px;font-size:14px;
                font-weight:600;text-decoration:none;">
        View All Notices
      </a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `📢 New Notice: ${title}`,
    html: emailLayout({
      title:      `New Notice: ${title}`,
      preheader:  summary || `New notice published: ${title}`,
      bodyContent,
    }),
  });
};