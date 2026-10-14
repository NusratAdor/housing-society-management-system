// server/services/emailService.js
//
// Single email provider: Resend.
// Every outbound email in the system goes through this file.
// Nothing else sends email — nodemailer is removed entirely.
//
// Public API:
//   sendPaymentConfirmationEmail({ to, name, amount, receiptNumber,
//                                  paidAt, allocations, remainingDue })
//   sendDueReminderEmail({ to, name, totalDue, totalMonthlyDue,
//                          totalExtraDue, unpaidMonths, unpaidCharges })
//   sendNoticeEmail(to, notice)
//
// All functions return a Promise.
// Callers that are non-critical (confirmation, reminder) use .catch()
// or try/catch so email failure never breaks the payment flow.
//
// CHANGE (this pass): sendPaymentConfirmationEmail now takes `allocations`
// (the PaymentAllocation records from allocatePayment()) instead of raw
// monthlyIds/extraIds. This fixes a real bug: for a partial payment on a
// partialPaymentAllowed charge, re-querying the charge document's current
// `amount` field after allocation returns the REMAINING balance, not what
// was actually paid in this transaction — which showed the wrong number
// on the receipt. Allocation records always hold the exact amount
// attributed to that charge in that specific payment, so they're the
// correct source of truth for a receipt breakdown.
//
// Also added `remainingDue` — the member's total outstanding balance
// AFTER this payment. This lets the email say "fully cleared" only when
// that's actually true, and show a clear remaining-balance line
// otherwise, instead of always claiming "dues are cleared."
//
// Internal architecture:
//   sendEmail()     — single Resend API call, throws on error
//   emailLayout()   — shared HTML wrapper for all emails
//   Each public function builds its own bodyContent and calls sendEmail()

import { Resend } from "resend";

// ─── Config ───────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL
  ? `GOHS <${process.env.FROM_EMAIL}>`
  : "GOHS <noreply@gohs.example.com>";
const FRONTEND = process.env.FRONTEND_URL || "https://yourdomain.com";
const SOCIETY = "Government Officer's Housing Society";
const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

const fmt = (n) => Number(n).toLocaleString();
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

/**
 * Core send function. All public functions call this.
 * Skips silently if RESEND_API_KEY is not configured (dev without email).
 * Throws on Resend API errors so callers can decide how to handle
 * (e.g. approvePayment catches this and reports emailSent: false, rather
 * than letting a failed email block a payment confirmation that has
 * already succeeded).
 */
const sendEmail = async ({ to, subject, html, replyTo }) => {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[Email] RESEND_API_KEY not set — skipped email to ${to}`);
    return { skipped: true };
  }

  

  const result = await resend.emails.send({
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result;
};

/**
 * Shared HTML layout wrapper.
 * All emails use this so they have a consistent branded appearance.
 * Inline styles only — email clients strip external/head CSS.
 */
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const emailLayout = ({ title, preheader, bodyContent }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;
             font-family:'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;
              color:#f6f7f9;font-size:1px;">
    ${esc(preheader)}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;">
        <tr>
          <td style="padding:0 0 14px;font-size:12px;font-weight:600;
                     letter-spacing:0.4px;color:#6b7280;text-transform:uppercase;">
            ${SOCIETY}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid #e5e7eb;
                     border-radius:8px;padding:32px;">
            <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827;">
              ${esc(title)}
            </h1>
            ${bodyContent}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 0;text-align:center;font-size:12px;
                     line-height:1.6;color:#9ca3af;">
            © ${new Date().getFullYear()} ${SOCIETY}<br/>
            This is an automated message — please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Row builders (reused across email types) ─────────────────────────────────

const chargeRow = ({ description, subtext, amount, isBold = false }) => `
  <tr>
    <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;
               font-size:14px;color:#374151;line-height:1.5;">
      ${esc(description)}
      ${
        subtext
          ? `<br/><span style="font-size:12px;color:#9ca3af;">${esc(subtext)}</span>`
          : ""
      }
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

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * sendPaymentConfirmationEmail
 * Sent after an admin confirms a gateway-verified payment.
 *
 * @param {Array} allocations   — PaymentAllocation records returned by
 *                                allocatePayment(): [{ chargeType, chargeId, amount }]
 *                                `amount` here is the exact amount attributed
 *                                to that charge in THIS payment — always
 *                                correct, unlike re-reading the charge's
 *                                current `amount` field, which can be a
 *                                post-payment remaining balance for a
 *                                partial-payment charge.
 * @param {number} remainingDue — member's total outstanding balance across
 *                                their whole account AFTER this payment.
 *                                Drives whether the email says "fully
 *                                cleared" or shows a remaining-balance line.
 *
 * Called from: adminPaymentController.approvePayment — the only call site.
 */

// ─── Statement building blocks (payment / credit emails) ─────────────────────

const money = (n) => `৳${fmt(n)}`;

const lineRow = ({ label, detail, amount, bold = false }) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f3;font-size:14px;
               color:#111827;line-height:1.5;${bold ? "font-weight:700;" : ""}">
      ${esc(label)}
      ${detail ? `<br/><span style="font-size:12px;font-weight:400;color:#9ca3af;">${esc(detail)}</span>` : ""}
    </td>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f3;font-size:14px;
               color:#111827;text-align:right;white-space:nowrap;
               ${bold ? "font-weight:700;" : ""}">
      ${money(amount)}
    </td>
  </tr>`;

const statementSection = (heading, rowsHtml) => `
  <p style="margin:24px 0 2px;font-size:11px;font-weight:600;color:#9ca3af;
            text-transform:uppercase;letter-spacing:0.5px;">${heading}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="border-collapse:collapse;">${rowsHtml}</table>`;

const noteParagraph = (text) =>
  `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">${text}</p>`;

const dashboardButton = () => `
  <div style="margin-top:28px;">
    <a href="${FRONTEND}/dashboard"
       style="display:inline-block;background:#064e3b;color:#ffffff;
              padding:12px 28px;border-radius:6px;font-size:14px;
              font-weight:600;text-decoration:none;">
      View dashboard
    </a>
  </div>`;

/**
 * sendPaymentConfirmationEmail
 * Called by the dispatcher with the queue payload { name, statement }
 * (statement built by paymentStatementService.buildPaymentStatement).
 *
 * Three separate things are shown, never mixed:
 *   THIS PAYMENT       cash received = applied to charges + added to credit
 *   CREDIT APPLIED     earlier credit that cleared a month (not new cash)
 *   ACCOUNT AFTER      credit balance and what is still owed
 */
const CONFIRMATION_COPY = {
  standard: { title: "Payment confirmed", subject: "Payment Confirmed" },
  advance: {
    title: "Advance payment confirmed",
    subject: "Advance Payment Confirmed",
  },
  completion: {
    title: "Monthly fee completed",
    subject: "Monthly Fee Completed",
  },
};

export const sendPaymentConfirmationEmail = async ({ to, name, statement }) => {
  if (!statement) {
    throw new Error("Payment confirmation email requires a statement payload");
  }

  const {
    kind = "standard",
    amount,
    receiptNumber,
    paidAt,
    applied = [],
    addedToCredit = 0,
    creditUsed = [],
    creditBefore = 0,
    creditBalance,
    monthlyDue,
    extraDue,
    totalDue,
  } = statement;

  const copy = CONFIRMATION_COPY[kind] ?? CONFIRMATION_COPY.standard;
  const creditUsedTotal = creditUsed.reduce((s, c) => s + c.amount, 0);

  let middle;
  let intro = `We have received your payment of <strong style="color:#111827;">${money(amount)}</strong> on ${fmtDate(paidAt)}.`;

  if (kind === "completion") {
    // Fee 400 = earlier credit 300 + this payment 100.
    const fromEarlier = Math.min(creditBefore, creditUsedTotal);
    const fromPayment = creditUsedTotal - fromEarlier;

    intro += ` It completes your ${creditUsed.map((c) => esc(c.label)).join(", ")} monthly fee.`;

    middle =
      statementSection(
        "This payment",
        lineRow({ label: "Payment received", amount, bold: true }),
      ) +
      statementSection(
        "Monthly fee",
        [
          ...creditUsed.map((c) =>
            lineRow({
              label: `Monthly maintenance — ${c.label}`,
              amount: c.amount,
            }),
          ),
          lineRow({
            label: "Monthly fee settled",
            amount: creditUsedTotal,
            bold: true,
          }),
        ].join(""),
      ) +
      statementSection(
        "How it was paid",
        [
          lineRow({ label: "From your earlier credit", amount: fromEarlier }),
          lineRow({ label: "From this payment", amount: fromPayment }),
          lineRow({
            label: "Credit remaining",
            amount: creditBalance ?? 0,
            bold: true,
          }),
        ].join(""),
      );
  } else {
    if (kind === "advance") {
      intro += " The full amount has been added to your credit balance.";
    }

    const paymentRows = [
      ...applied.map((a) =>
        lineRow({ label: a.label, detail: a.detail, amount: a.amount }),
      ),
      ...(addedToCredit > 0
        ? [lineRow({ label: "Added to credit balance", amount: addedToCredit })]
        : []),
      lineRow({ label: "Total received", amount, bold: true }),
    ].join("");

    middle =
      statementSection("This payment", paymentRows) +
      (creditUsed.length > 0
        ? statementSection(
            "Credit applied",
            [
              ...creditUsed.map((c) =>
                lineRow({
                  label: `Monthly maintenance — ${c.label}`,
                  amount: c.amount,
                }),
              ),
              lineRow({
                label: "Total credit applied",
                amount: creditUsedTotal,
                bold: true,
              }),
            ].join(""),
          ) +
          noteParagraph(
            "Paid from money you deposited earlier. This is not a new payment.",
          )
        : "");
  }

  const hasAccount = creditBalance !== undefined && totalDue !== undefined;
  const accountSection = hasAccount
    ? statementSection(
        "Account after this payment",
        [
          lineRow({ label: "Credit balance", amount: creditBalance }),
          lineRow({ label: "Monthly dues outstanding", amount: monthlyDue }),
          lineRow({ label: "Extra charges outstanding", amount: extraDue }),
          lineRow({ label: "Total outstanding", amount: totalDue, bold: true }),
        ].join(""),
      )
    : "";

  const closing = !hasAccount
    ? ""
    : totalDue > 0
      ? noteParagraph(
          "You still have dues outstanding. You can pay them from your dashboard.",
        )
      : creditBalance > 0
        ? noteParagraph(
            "Your credit balance is applied automatically when your next monthly fee is billed.",
          )
        : noteParagraph(
            kind === "completion"
              ? "Your monthly fee is fully paid. You can now pay ahead for future months from your dashboard."
              : "Your dues are fully paid.",
          );

  const bodyContent = `
    <p style="margin:0 0 6px;font-size:15px;color:#111827;">Dear ${esc(name)},</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
      ${intro}
      Receipt <span style="font-family:monospace;color:#111827;">${esc(receiptNumber)}</span>.
    </p>
    ${middle}
    ${accountSection}
    ${closing}
    ${dashboardButton()}
  `;

  return sendEmail({
    to,
    subject: `${copy.subject} — Receipt ${receiptNumber}`,
    html: emailLayout({
      title: copy.title,
      preheader: `${money(amount)} received · Receipt ${receiptNumber}`,
      bodyContent,
    }),
  });
};

export const sendAdvancePaymentConfirmationEmail = sendPaymentConfirmationEmail;

/**
 * sendCreditShortfallEmail
 * Sent when a fee increase leaves a member's credit below the new monthly fee.
 * ACTION REQUIRED: the member must pay the remaining amount.
 */
export const sendCreditShortfallEmail = async ({
  to,
  name,
  month,
  year,
  feeAmount,
  creditBalance,
  amount,
}) => {
  const label = `${MONTH_NAMES[month]} ${year}`;

  const bodyContent = `
    <p style="margin:0 0 6px;font-size:15px;color:#111827;">Dear ${esc(name)},</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
      Your ${label} monthly fee is <strong style="color:#111827;">${money(feeAmount)}</strong>,
      which is more than the credit you hold. Please pay the remaining
      <strong style="color:#111827;">${money(amount)}</strong> to settle this month.
    </p>
    ${statementSection(
      label,
      [
        lineRow({ label: "Monthly maintenance fee", amount: feeAmount }),
        lineRow({ label: "Your credit balance", amount: creditBalance }),
        lineRow({ label: "Remaining to pay", amount, bold: true }),
      ].join(""),
    )}
    ${noteParagraph(
      "Your credit is held unchanged and is used together with your payment. " +
        "Advance payments for later months open once this month is settled.",
    )}
    <div style="margin-top:28px;">
      <a href="${FRONTEND}/dashboard"
         style="display:inline-block;background:#064e3b;color:#ffffff;padding:12px 28px;
                border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
        Pay ${money(amount)}
      </a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Action required: ${money(amount)} remaining for ${label}`,
    html: emailLayout({
      title: "Action required: complete your monthly payment",
      preheader: `${money(amount)} remaining for ${label}`,
      bodyContent,
    }),
  });
};

/**
 * sendCreditAppliedEmail
 * Sent when the monthly cron clears a new month from the member's credit.
 * There is no new payment, so this is NOT a payment confirmation.
 */
export const sendCreditAppliedEmail = async ({
  to,
  name,
  month,
  year,
  amount,
  creditAfter,
}) => {
  const label = `${MONTH_NAMES[month]} ${year}`;

  const bodyContent = `
    <p style="margin:0 0 6px;font-size:15px;color:#111827;">Dear ${esc(name)},</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
      Your ${label} monthly maintenance fee has been paid automatically from
      your credit balance. No payment is needed for this month.
    </p>
    ${statementSection(
      "Monthly fee",
      [
        lineRow({ label: `Monthly maintenance — ${label}`, amount }),
        lineRow({ label: "Paid from credit balance", amount }),
        lineRow({ label: "Amount to pay", amount: 0, bold: true }),
      ].join(""),
    )}
    ${statementSection(
      "Your credit balance",
      lineRow({ label: "Credit remaining", amount: creditAfter, bold: true }),
    )}
    ${dashboardButton()}
  `;

  return sendEmail({
    to,
    subject: `${label} fee paid from your credit`,
    html: emailLayout({
      title: "Monthly fee paid from credit",
      preheader: `${label} · ${money(amount)} paid from credit · ${money(creditAfter)} remaining`,
      bodyContent,
    }),
  });
};

/**
 * sendDueReminderEmail
 * Sent once a month, 9 days before month-end, to members with outstanding dues.
 * Called via the email queue dispatcher (server/jobs/paymentJobs.js).
 * Amounts come from live unpaid-charge queries.
 */
export const sendDueReminderEmail = async ({
  to,
  name,
  totalDue,
  totalMonthlyDue,
  totalExtraDue,
  unpaidMonths = [],
  unpaidCharges = [],
  creditBalance = 0,
  creditShortfall = 0,
}) => {
  const monthlyRows = unpaidMonths
    .map((m) =>
      chargeRow({
        description: `Monthly Maintenance — ${MONTH_NAMES[m.month]} ${m.year}`,
        amount: m.amount,
      }),
    )
    .join("");

  const extraRows = unpaidCharges
    .map((c) =>
      chargeRow({
        description: c.label,
        subtext: c.purpose,
        amount: c.amount,
      }),
    )
    .join("");

  const hasMonthly = unpaidMonths.length > 0;
  const hasExtra = unpaidCharges.length > 0;

  const creditNote =
    creditBalance > 0
      ? `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#4b5563;">
           You have ${money(creditBalance)} in credit.
           ${
             creditShortfall > 0
               ? `Add ${money(creditShortfall)} to cover your oldest unpaid month with it, or pay the full amount above and keep your credit.`
               : "Credit is applied to monthly fees only, not to extra charges."
           }
         </p>`
      : "";

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
      Dear <strong>${esc(name)}</strong>,
    </p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.7;">
      This is a friendly reminder that you have outstanding dues of
      <strong style="font-size:18px;color:#dc2626;">৳${fmt(totalDue)}</strong>
      that should be cleared before the end of this month.
    </p>

    ${
      hasMonthly
        ? `
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
    `
        : ""
    }

    ${
      hasExtra
        ? `
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
    `
        : ""
    }

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

      ${creditNote}

    <div style="text-align:center;">
      <a href="${FRONTEND}/dashboard"
         style="display:inline-block;background:#dc2626;color:#ffffff;
                padding:14px 40px;border-radius:8px;font-size:15px;
                font-weight:700;text-decoration:none;">
        Pay Now
      </a>
                  <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">
        You will receive this reminder once a month while dues remain outstanding.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `⏰ Payment Reminder — ৳${fmt(totalDue)} Due`,
    html: emailLayout({
      title: "Payment Reminder",
      preheader: `You have ৳${fmt(totalDue)} outstanding. Please pay before month-end.`,
      bodyContent,
    }),
  });
};

/**
 * sendNoticeEmail
 * Sent to all members when admin publishes a notice.
 * UNCHANGED.
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
      ${esc(title)}
    </h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">
      ${date ? fmtDate(date) : ""}
    </p>

    ${
      optimisedImage
        ? `
            <img src="${esc(optimisedImage)}" alt="${esc(title)}"
           width="520" style="max-width:100%;height:auto;border-radius:10px;
                              display:block;margin:0 0 20px;" />
    `
        : ""
    }

    ${
      summary
        ? `
      <div style="background:#f0fdf4;border-left:3px solid #10b981;
                  padding:12px 16px;border-radius:0 6px 6px 0;margin:0 0 20px;">
        <p style="margin:0;font-size:15px;font-weight:500;color:#065f46;
                  line-height:1.6;">
          ${esc(summary)}
        </p>
      </div>
    `
        : ""
    }

    <div style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 28px;">
            ${esc(content).replace(/\n/g, "<br/>")}
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
      title: `New Notice: ${title}`,
      preheader: summary || `New notice published: ${title}`,
      bodyContent,
    }),
  });
};



/**
 * sendContactMessageEmail
 * Forwards a public Contact-page message to the society office.
 * The visitor's address is set as Reply-To, so "Reply" answers them directly.
 * No confirmation is sent to the visitor, so the form cannot be used to
 * email arbitrary third parties.
 */
export const sendContactMessageEmail = async ({ name, email, subject, message }) => {
  const recipient = process.env.CONTACT_RECIPIENT_EMAIL;
  if (!recipient) {
    throw new Error("CONTACT_RECIPIENT_EMAIL is not configured");
  }

  const bodyContent = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;width:70px;font-size:13px;color:#6b7280;">From</td>
        <td style="padding:4px 0;font-size:14px;color:#111827;">${esc(name)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Email</td>
        <td style="padding:4px 0;font-size:14px;color:#111827;">${esc(email)}</td>
      </tr>
    </table>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;
                font-size:15px;line-height:1.7;color:#374151;">
      ${esc(message).replace(/\r?\n/g, "<br/>")}
    </div>
    ${noteParagraph("Reply to this email to respond directly to the sender.")}
  `;

  return sendEmail({
    to: recipient,
    replyTo: email,
    subject: `Website contact: ${subject}`,
    html: emailLayout({
      title: subject,
      preheader: message.slice(0, 100),
      bodyContent,
    }),
  });
};