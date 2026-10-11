// server/services/paymentStatementService.js
//
// ONE statement per confirmed payment, rendered by both the in-app
// notification and the confirmation email.
//
//   amount (cash received) = sum(applied) + addedToCredit
//   creditUsed             = months later cleared from credit (not new cash)
//
// `kind` is derived from what actually happened, never from advanceAmount alone:
//   standard   – the payment cleared charges
//   completion – ALL the money went to credit AND a month was cleared with it
//   advance    – ALL the money went to credit and no month was cleared
//
// creditBefore is captured by the caller BEFORE allocation (explicit, not
// reconstructed). paidAt is the real timestamp recorded on the Payment.

import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge from "../models/ExtraCharge.js";
import { getMemberCreditBalance } from "./creditService.js";
import { getMemberDueSummary } from "./paymentService.js";

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

export const buildPaymentStatement = async ({
  payment,
  receiptNumber,
  paidAt,
  creditBefore = null,
  allocations = [],
  creditClearedIds = [],
}) => {
  const monthlyIds = allocations
    .filter((a) => a.chargeType === "monthly")
    .map((a) => a.chargeId);
  const extraIds = allocations
    .filter((a) => a.chargeType === "extra")
    .map((a) => a.chargeId);

  const [monthlyMeta, extraMeta, creditMeta, creditBalance, due] =
    await Promise.all([
      monthlyIds.length
        ? MonthlyCharge.find({ _id: { $in: monthlyIds } })
            .select("month year")
            .lean()
        : [],
      extraIds.length
        ? ExtraCharge.find({ _id: { $in: extraIds } })
            .select("label purpose")
            .lean()
        : [],
      creditClearedIds.length
        ? MonthlyCharge.find({ _id: { $in: creditClearedIds } })
            .select("month year amount")
            .lean()
        : [],
      getMemberCreditBalance(payment.member),
      getMemberDueSummary(payment.member),
    ]);

  const monthlyById = new Map(monthlyMeta.map((c) => [String(c._id), c]));
  const extraById = new Map(extraMeta.map((c) => [String(c._id), c]));

  const appliedMonthly = allocations
    .filter((a) => a.chargeType === "monthly")
    .map((a) => {
      const c = monthlyById.get(String(a.chargeId));
      return c ? { year: c.year, month: c.month, amount: a.amount } : null;
    })
    .filter(Boolean)
    .sort((x, y) => x.year - y.year || x.month - y.month)
    .map((m) => ({
      label: `${MONTH_NAMES[m.month]} ${m.year}`,
      amount: m.amount,
    }));

  const appliedExtra = allocations
    .filter((a) => a.chargeType === "extra")
    .map((a) => {
      const c = extraById.get(String(a.chargeId));
      return c ? { label: c.label, detail: c.purpose, amount: a.amount } : null;
    })
    .filter(Boolean);

  const applied = [...appliedMonthly, ...appliedExtra];
  const addedToCredit = payment.advanceAmount || 0;

  const creditUsed = [...creditMeta]
    .sort((x, y) => x.year - y.year || x.month - y.month)
    .map((c) => ({
      label: `${MONTH_NAMES[c.month]} ${c.year}`,
      amount: c.amount,
    }));

  // The money went ONLY to credit when nothing was applied to a charge.
  let kind = "standard";
  if (applied.length === 0 && addedToCredit > 0) {
    kind = creditUsed.length > 0 ? "completion" : "advance";
  }

  if (kind === "completion" && creditBefore == null) {
    throw new Error("A completion statement requires creditBefore");
  }

  const accounted = applied.reduce((s, a) => s + a.amount, 0) + addedToCredit;
  if (Math.abs(accounted - payment.amount) > 0.01) {
    console.warn(
      `[Statement] Payment ${payment._id}: lines add to ৳${accounted} but amount is ৳${payment.amount}`,
    );
  }

  return {
    kind,
    amount: payment.amount,
    receiptNumber,
    paidAt: paidAt ?? payment.paidAt ?? new Date(),
    applied,
    addedToCredit,
    creditUsed,
    creditBefore: creditBefore ?? 0,
    creditBalance,
    monthlyDue: due.totalMonthlyDue,
    extraDue: due.totalExtraDue,
    totalDue: due.totalDue,
  };
};
