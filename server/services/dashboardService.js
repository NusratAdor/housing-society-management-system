// server/services/dashboardService.js
//
// Aggregates all data the member dashboard needs into single service calls.
//
// CHANGE (this pass):
//   - Opening Balance split logic removed entirely (partialPaymentAllowed
//     no longer exists on ExtraCharge — that feature has been replaced by
//     real backdated MonthlyCharge generation at registration time).
//   - Added paidThroughMonth — a computed (never stored) indicator of
//     "dues current through <month/year>", derived the same way for every
//     member: the most recent month in an unbroken PAID streak counting
//     backward from the current month. null if the member has no paid
//     months yet, or if the current/most-recent month itself is unpaid.

import mongoose          from "mongoose";
import Member            from "../models/Member.js";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import ExtraCharge       from "../models/ExtraCharge.js";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import { getCurrentFee } from "./feeService.js";
import { getMemberCreditBalance } from "./creditService.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── computePaidThroughMonth ───────────────────────────────────────────────
// Walks the member's monthly charge history backward from the newest
// month, counting how far back an unbroken "Paid" streak goes. Returns
// { month, year, label } for the oldest month in that streak's most
// recent edge (i.e. the newest fully-paid point), or null if there is no
// such streak (e.g. the most recent month on record is unpaid, or there
// are no monthly charges at all yet).

const computePaidThroughMonth = (last12MonthsDescending) => {
  if (last12MonthsDescending.length === 0) return null;

  const newest = last12MonthsDescending[0];
  if (newest.status !== "Paid") return null;

  // The streak by definition starts at the newest record — if it's
  // Paid, dues are current through that month. No need to walk the
  // list further; walking backward and reassigning was the bug that
  // reported the OLDEST month in the streak instead of the newest.
  return {
    month: newest.month,
    year:  newest.year,
    label: `${MONTH_NAMES[newest.month]} ${newest.year}`,
  };
};

// ─── getMemberFullDashboardData ───────────────────────────────────────────────

export const getMemberFullDashboardData = async (memberId) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const [
    unpaidMonthlyCharges,
    unpaidExtraCharges,
    last12Months,
    lastCompletedPayment,
    currentFee,
    pendingPayment,
    awaitingConfirmationPayment,
    creditBalance,
  ] = await Promise.all([

    MonthlyCharge
      .find({
        member: memberObjectId,
        status: "Unpaid",
        month:  { $gte: 1, $lte: 12 },
        year:   { $gte: 2000 },
      })
      .sort({ year: 1, month: 1 })
      .lean(),

    ExtraCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ createdAt: 1 })
      .lean(),

    MonthlyCharge
      .find({
        member: memberObjectId,
        month:  { $gte: 1, $lte: 12 },
        year:   { $gte: 2000 },
      })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean(),

    Payment
      .findOne({ member: memberObjectId, status: "completed" })
      .sort({ paidAt: -1 })
      .select("amount paidAt receiptNumber")
      .lean(),

    getCurrentFee(),

    Payment
      .findOne({ member: memberObjectId, status: "pending" })
      .sort({ createdAt: -1 })
      .select("_id amount createdAt transactionId")
      .lean(),

    Payment
      .findOne({ member: memberObjectId, status: "verified" })
      .sort({ verifiedAt: -1 })
      .select("_id amount verifiedAt transactionId")
      .lean(),

    getMemberCreditBalance(memberId),
  ]);

  const totalMonthlyDue = unpaidMonthlyCharges.reduce((sum, c) => sum + c.amount, 0);
  const totalExtraDue   = unpaidExtraCharges.reduce((sum, c) => sum + c.amount, 0);

  const totalDue = totalMonthlyDue + totalExtraDue;
  const paymentStatus = totalDue === 0 ? "Paid" : "Due";

  const nextDueMonth = unpaidMonthlyCharges.length > 0
    ? {
        month:  unpaidMonthlyCharges[0].month,
        year:   unpaidMonthlyCharges[0].year,
        amount: unpaidMonthlyCharges[0].amount,
      }
    : null;

  const paidThroughMonth = computePaidThroughMonth(last12Months);

  return {
    currentFee,
    totalDue,
    totalMonthlyDue,
    totalExtraDue,
    paymentStatus,
    nextDueMonth,
    paidThroughMonth,

    lastPayment: lastCompletedPayment
      ? {
          amount:        lastCompletedPayment.amount,
          paidAt:        lastCompletedPayment.paidAt,
          receiptNumber: lastCompletedPayment.receiptNumber,
        }
      : null,

    pendingPayment: pendingPayment
      ? {
          paymentId:  String(pendingPayment._id),
          amount:     pendingPayment.amount,
          createdAt:  pendingPayment.createdAt,
        }
      : null,

    awaitingConfirmationPayment: awaitingConfirmationPayment
      ? {
          paymentId:  String(awaitingConfirmationPayment._id),
          amount:     awaitingConfirmationPayment.amount,
          verifiedAt: awaitingConfirmationPayment.verifiedAt,
        }
      : null,

    creditBalance,

    unpaidMonthlyCharges,
    unpaidExtraCharges,

    last12Months,
  };
};

// ─── getMemberTransactionHistory ─────────────────────────────────────────────
// UNCHANGED.

export const getMemberTransactionHistory = async (memberId, limit = 24) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const payments = await Payment
    .find({
      member: memberObjectId,
      status: { $in: ["completed", "failed", "rejected"] },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (payments.length === 0) return [];

  const paymentIds = payments.map(p => p._id);
  const allAllocations = await PaymentAllocation
    .find({ payment: { $in: paymentIds } })
    .lean();

  const allocationsByPayment = {};
  for (const alloc of allAllocations) {
    const pid = String(alloc.payment);
    if (!allocationsByPayment[pid]) allocationsByPayment[pid] = [];
    allocationsByPayment[pid].push(alloc);
  }

  const monthlyChargeIds = allAllocations
    .filter(a => a.chargeType === "monthly")
    .map(a => a.chargeId);
  const extraChargeIds = allAllocations
    .filter(a => a.chargeType === "extra")
    .map(a => a.chargeId);

  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyChargeIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyChargeIds } })
          .select("month year amount")
          .lean()
      : [],
    extraChargeIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraChargeIds } })
          .select("label purpose amount")
          .lean()
      : [],
  ]);

  const monthlyMap = Object.fromEntries(monthlyCharges.map(c => [String(c._id), c]));
  const extraMap   = Object.fromEntries(extraCharges.map(c => [String(c._id), c]));

  return payments.map(payment => {
    const allocations = allocationsByPayment[String(payment._id)] || [];

    const breakdown = allocations.map(alloc => {
      if (alloc.chargeType === "monthly") {
        const charge = monthlyMap[String(alloc.chargeId)];
        return charge
          ? { type: "monthly", month: charge.month, year: charge.year, amount: alloc.amount }
          : null;
      } else {
        const charge = extraMap[String(alloc.chargeId)];
        return charge
          ? { type: "extra", label: charge.label, purpose: charge.purpose, amount: alloc.amount }
          : null;
      }
    }).filter(Boolean);

    return { ...payment, breakdown };
  });
};