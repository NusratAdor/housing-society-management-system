// server/services/dashboardService.js
//
// Aggregates all data the member dashboard needs (/api/payments/me/breakdown).
// A monthly charge is either Unpaid or Paid — no partial state.
//
// CHANGE (this pass): the backend now computes the prepay options
// (`prepay`), the credit shortfall for the oldest unpaid month
// (`creditShortfall`) and any scheduled fee change (`upcomingFeeChange`).
// The frontend only displays them. Prepay months are priced at each month's
// FeeHistory fee, using the Dhaka calendar (not the browser clock).

import mongoose from "mongoose";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge from "../models/ExtraCharge.js";
import Payment from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import { getCurrentFee, getPrepayPlan } from "./feeService.js";
import { getMemberCreditBalance } from "./creditService.js";
import { MAX_PREPAY_MONTHS } from "../configs/paymentConfig.js";
import {
  getDirectAllocations,
  buildAdvanceItem,
} from "../utils/paymentBreakdown.js";

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

// Dues are current through the newest month on record when it is "Paid".
const computePaidThroughMonth = (last12MonthsDescending) => {
  if (last12MonthsDescending.length === 0) return null;

  const newest = last12MonthsDescending[0];
  if (newest.status !== "Paid") return null;

  return {
    month: newest.month,
    year: newest.year,
    label: `${MONTH_NAMES[newest.month]} ${newest.year}`,
  };
};

// ─── getMemberFullDashboardData ───────────────────────────────────────────

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
    MonthlyCharge.find({
      member: memberObjectId,
      status: "Unpaid",
      month: { $gte: 1, $lte: 12 },
      year: { $gte: 2000 },
    })
      .sort({ year: 1, month: 1 })
      .lean(),

    ExtraCharge.find({ member: memberObjectId, status: "Unpaid" })
      .sort({ createdAt: 1 })
      .lean(),

    MonthlyCharge.find({
      member: memberObjectId,
      month: { $gte: 1, $lte: 12 },
      year: { $gte: 2000 },
    })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean(),

    Payment.findOne({ member: memberObjectId, status: "completed" })
      .sort({ paidAt: -1 })
      .select("amount paidAt receiptNumber")
      .lean(),

    getCurrentFee(),

    Payment.findOne({ member: memberObjectId, status: "pending" })
      .sort({ createdAt: -1 })
      .select("_id amount createdAt transactionId")
      .lean(),

    Payment.findOne({
      member: memberObjectId,
      status: { $in: ["verified", "processing"] },
    })
      .sort({ verifiedAt: -1 })
      .select("_id amount verifiedAt transactionId")
      .lean(),

    getMemberCreditBalance(memberId),
  ]);

  const totalMonthlyDue = unpaidMonthlyCharges.reduce(
    (sum, c) => sum + c.amount,
    0,
  );
  const totalExtraDue = unpaidExtraCharges.reduce(
    (sum, c) => sum + c.amount,
    0,
  );

  const totalDue = totalMonthlyDue + totalExtraDue;
  const paymentStatus = totalDue === 0 ? "Paid" : "Due";

  const nextDueMonth =
    unpaidMonthlyCharges.length > 0
      ? {
          month: unpaidMonthlyCharges[0].month,
          year: unpaidMonthlyCharges[0].year,
          amount: unpaidMonthlyCharges[0].amount,
        }
      : null;

  const paidThroughMonth = computePaidThroughMonth(last12Months);

  // ── Prepay options: priced per month from FeeHistory, computed here ──
  const plan = await getPrepayPlan({
    newestCharge: last12Months[0] ?? null,
    creditBalance,
  });

  const changed = plan.fees.find((f) => f.amount !== currentFee);
  const upcomingFeeChange = changed
    ? { month: changed.month, year: changed.year, fee: changed.amount }
    : null;

  // Credit only ever clears the OLDEST unpaid month, all-or-nothing.
  const oldestUnpaid = unpaidMonthlyCharges[0] ?? null;
  const shortfallAmount =
    oldestUnpaid && creditBalance > 0 && creditBalance < oldestUnpaid.amount
      ? oldestUnpaid.amount - creditBalance
      : 0;

  const shortfall =
    shortfallAmount > 0
      ? {
          month: oldestUnpaid.month,
          year: oldestUnpaid.year,
          feeAmount: oldestUnpaid.amount,
          creditBalance,
          amount: shortfallAmount,
        }
      : null;

  const advanceLock = shortfall
    ? {
        locked: true,
        reason:
          `Your credit is ৳${shortfall.amount.toLocaleString()} short of the ` +
          `${MONTH_NAMES[shortfall.month]} ${shortfall.year} fee. ` +
          `Complete that payment before paying further ahead.`,
      }
    : { locked: false, reason: null };

  return {
    currentFee,
    maxPrepayMonths: MAX_PREPAY_MONTHS,
    totalDue,
    totalMonthlyDue,
    totalExtraDue,
    paymentStatus,
    nextDueMonth,
    paidThroughMonth,

    lastPayment: lastCompletedPayment
      ? {
          amount: lastCompletedPayment.amount,
          paidAt: lastCompletedPayment.paidAt,
          receiptNumber: lastCompletedPayment.receiptNumber,
        }
      : null,

    pendingPayment: pendingPayment
      ? {
          paymentId: String(pendingPayment._id),
          amount: pendingPayment.amount,
          createdAt: pendingPayment.createdAt,
        }
      : null,

    awaitingConfirmationPayment: awaitingConfirmationPayment
      ? {
          paymentId: String(awaitingConfirmationPayment._id),
          amount: awaitingConfirmationPayment.amount,
          verifiedAt: awaitingConfirmationPayment.verifiedAt,
        }
      : null,

    creditBalance,
    creditShortfall: shortfallAmount,
    shortfall,
    advanceLock,
    prepay: {
      options: plan.options,
      coveredThrough: plan.coveredThrough,
    },
    upcomingFeeChange,

    unpaidMonthlyCharges,
    unpaidExtraCharges,

    last12Months,
  };
};

// ─── getMemberTransactionHistory ─────────────────────────────────────────
// UNCHANGED.

export const getMemberTransactionHistory = async (memberId, limit = 24) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const payments = await Payment.find({
    member: memberObjectId,
    status: { $in: ["completed", "failed", "rejected"] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (payments.length === 0) return [];

  const paymentIds = payments.map((p) => p._id);
  const allAllocations = await PaymentAllocation.find({
    payment: { $in: paymentIds },
  }).lean();

  const allocationsByPayment = {};
  for (const alloc of allAllocations) {
    const pid = String(alloc.payment);
    if (!allocationsByPayment[pid]) allocationsByPayment[pid] = [];
    allocationsByPayment[pid].push(alloc);
  }

  const monthlyChargeIds = allAllocations
    .filter((a) => a.chargeType === "monthly")
    .map((a) => a.chargeId);
  const extraChargeIds = allAllocations
    .filter((a) => a.chargeType === "extra")
    .map((a) => a.chargeId);

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

  const monthlyMap = Object.fromEntries(
    monthlyCharges.map((c) => [String(c._id), c]),
  );
  const extraMap = Object.fromEntries(
    extraCharges.map((c) => [String(c._id), c]),
  );

  return payments.map((payment) => {
    const allocations = getDirectAllocations(
      payment,
      allocationsByPayment[String(payment._id)] || [],
    );

    const breakdown = allocations
      .map((alloc) => {
        if (alloc.chargeType === "monthly") {
          const charge = monthlyMap[String(alloc.chargeId)];
          return charge
            ? {
                type: "monthly",
                month: charge.month,
                year: charge.year,
                amount: alloc.amount,
              }
            : null;
        } else {
          const charge = extraMap[String(alloc.chargeId)];
          return charge
            ? {
                type: "extra",
                label: charge.label,
                purpose: charge.purpose,
                amount: alloc.amount,
              }
            : null;
        }
      })
      .filter(Boolean);

    const advanceItem = buildAdvanceItem(payment);
    return {
      ...payment,
      breakdown: advanceItem ? [...breakdown, advanceItem] : breakdown,
    };
  });
};
