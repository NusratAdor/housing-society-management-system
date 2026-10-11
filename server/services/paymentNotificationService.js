// server/services/paymentNotificationService.js
//
// One place for every financial in-app notification.
// Rules:
//   - Notifications are best-effort: a failure is logged, never thrown, so it
//     can never break a payment or a cron run.
//   - Every message has an eventKey (unique index on Notification), so the
//     same financial event can never notify twice.
//   - Vocabulary: "Applied to" (payment cleared a charge),
//     "Added to credit balance" (unused money banked),
//     "Credit applied" (earlier credit cleared a charge).

import Notification from "../models/Notification.js";

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

const money = (n) => `৳${Number(n || 0).toLocaleString("en-US")}`;
const monthLabel = (month, year) => `${MONTH_NAMES[month]} ${year}`;
const pad = (n) => String(n).padStart(2, "0");

export const createNotificationOnce = async ({
  eventKey,
  content,
  clerkUserId = null,
  type = "Payment",
}) => {
  try {
    return await Notification.create({
      type,
      content,
      clerkUserId,
      adminOnly: false,
      ...(eventKey ? { eventKey } : {}),
    });
  } catch (error) {
    if (error?.code === 11000) return null; // already notified for this event
    console.error("[Notification] create failed:", error.message);
    return null;
  }
};

// Broadcast to every member (clerkUserId: null).
export const notifyMonthlyFeeAdded = ({ month, year, fee }) =>
  createNotificationOnce({
    eventKey: `MONTHLY_FEE_ADDED:${year}-${pad(month)}`,
    content:
      `Monthly maintenance fee of ${money(fee)} has been added for ${monthLabel(month, year)}. ` +
      `If your credit covers it, it is cleared automatically; otherwise please pay before month-end.`,
  });

// Broadcast. `effectiveFrom` is the UTC-midnight 1st-of-month Date from FeeHistory.
export const notifyFeeChanged = ({
  recordId,
  previousFee,
  newFee,
  effectiveFrom,
}) =>
  createNotificationOnce({
    eventKey: `FEE_CHANGED:${recordId}`,
    content:
      `The monthly maintenance fee changes from ${money(previousFee)} to ${money(newFee)}, ` +
      `effective ${monthLabel(effectiveFrom.getUTCMonth() + 1, effectiveFrom.getUTCFullYear())}. ` +
      `Advance credit is applied to each month at that month's fee.`,
  });

export const notifyCreditApplied = ({
  clerkUserId,
  chargeId,
  month,
  year,
  amount,
  creditAfter,
}) =>
  createNotificationOnce({
    clerkUserId,
    eventKey: `CREDIT_APPLIED:${chargeId}`,
    content:
      `${monthLabel(month, year)} fee (${money(amount)}) was paid from your credit balance. ` +
      `Credit remaining: ${money(creditAfter)}. Nothing to pay for this month.`,
  });

export const notifyCreditShortfall = ({
  clerkUserId,
  chargeId,
  month,
  year,
  chargeAmount,
  available,
}) =>
  createNotificationOnce({
    clerkUserId,
    eventKey: `CREDIT_SHORT:${chargeId}`,
    content:
      `Your credit (${money(available)}) does not fully cover the ${monthLabel(month, year)} ` +
      `fee (${money(chargeAmount)}). Pay the remaining ${money(chargeAmount - available)} ` +
      `to settle this month. Advance payments for later months open once it is settled.`,
  });



// ONE message per confirmed payment. `statement` comes from
// paymentStatementService.buildPaymentStatement (same data as the email).
// Fallback: { amount, receiptNumber } only.
export const notifyPaymentConfirmed = ({ clerkUserId, paymentId, statement }) => {
  const {
    amount, receiptNumber, kind = "standard",
    applied = [], addedToCredit = 0, creditUsed = [],
    creditBefore = 0, creditBalance, totalDue,
  } = statement;

  const parts = [];

  if (kind === "completion") {
    const used = creditUsed.reduce((s, c) => s + c.amount, 0);
    parts.push(`Payment of ${money(amount)} confirmed. Receipt ${receiptNumber}.`);
    parts.push(
      creditBefore > 0
        ? `With your earlier credit of ${money(creditBefore)}, it settled ` +
            `${creditUsed.map((c) => c.label).join(", ")} (${money(used)}).`
        : `It settled ${creditUsed.map((c) => c.label).join(", ")} (${money(used)}).`,
    );
  } else if (kind === "advance") {
    parts.push(`Advance payment of ${money(amount)} confirmed. Receipt ${receiptNumber}.`);
    parts.push(`Added to credit balance: ${money(addedToCredit)}.`);
  } else {
    parts.push(`Payment of ${money(amount)} confirmed. Receipt ${receiptNumber}.`);
    if (applied.length > 0) {
      parts.push(`Applied to: ${applied.map((a) => a.label).join(", ")}.`);
    }
    if (addedToCredit > 0) parts.push(`Added to credit balance: ${money(addedToCredit)}.`);
    if (creditUsed.length > 0) {
      parts.push(
        `Credit applied to ${creditUsed.map((c) => `${c.label} (${money(c.amount)})`).join(", ")}.`,
      );
    }
  }

  if (creditBalance !== undefined) parts.push(`Credit balance: ${money(creditBalance)}.`);
  if (totalDue !== undefined) {
    parts.push(totalDue > 0 ? `Outstanding: ${money(totalDue)}.` : "No dues outstanding.");
  }

  return createNotificationOnce({
    clerkUserId,
    eventKey: `PAYMENT_CONFIRMED:${paymentId}`,
    content: parts.join(" "),
  });
};