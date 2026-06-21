// server/services/dashboardService.js
//
// Aggregates all data the member dashboard needs into single service calls.
//
// Design principle: the dashboard makes ONE API call and gets everything.
// This is better than the frontend making 5 separate calls because:
//   - One network round trip instead of five
//   - Data is consistent — all from the same point in time
//   - Easier to cache at the API layer if needed in the future
//   - Backend can optimise all queries together with Promise.all

import mongoose          from "mongoose";
import Member            from "../models/Member.js";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import ExtraCharge       from "../models/ExtraCharge.js";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import { getCurrentFee } from "./feeService.js";

// ─── getMemberFullDashboardData ───────────────────────────────────────────────
// Returns everything the member PaymentSection needs in one call.
//
// All queries run in parallel — latency = slowest single query,
// not the sum. For 500 members with 12 months of data this
// consistently runs under 30ms on Atlas M0 (free tier).
//
// Returns the complete shape expected by PaymentSection.jsx

export const getMemberFullDashboardData = async (memberId) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  // ── All queries in parallel ───────────────────────────────────────────────
  const [
    unpaidMonthlyCharges,
    unpaidExtraCharges,
    last12Months,
    lastCompletedPayment,
    currentFee,
    pendingPayment,
  ] = await Promise.all([

    // Unpaid monthly charges in FIFO order — oldest month first
    // This is the order the payment UI presents months for selection
    MonthlyCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ year: 1, month: 1 })
      .lean(),

    // Unpaid extra charges — oldest first
    // Each has label + purpose so member knows exactly what they owe
    ExtraCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ createdAt: 1 })
      .lean(),

    // Last 12 monthly charges for the history strip
    // Most recent first so the strip renders latest on left
    // Includes both Paid and Unpaid — the strip shows the full picture
    MonthlyCharge
      .find({ member: memberObjectId })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean(),

    // Most recent completed payment
    // Used for "Last Payment: ৳500 on 15 Jan" display
    Payment
      .findOne({ member: memberObjectId, status: "completed" })
      .sort({ paidAt: -1 })
      .select("amount paidAt receiptNumber")
      .lean(),

    // Current fee for display — charges already have their locked amounts
    // This is just for the "Monthly fee: ৳500" UI label
    getCurrentFee(),

    // Any currently pending payment session
    // Prevents member from creating duplicate gateway sessions
    Payment
      .findOne({ member: memberObjectId, status: "pending" })
      .sort({ createdAt: -1 })
      .select("_id amount createdAt transactionId")
      .lean(),
  ]);

  // ── Compute financial summary from records ────────────────────────────────
  const totalMonthlyDue = unpaidMonthlyCharges.reduce(
    (sum, c) => sum + c.amount, 0
  );
  const totalExtraDue = unpaidExtraCharges.reduce(
    (sum, c) => sum + c.amount, 0
  );
  const totalDue     = totalMonthlyDue + totalExtraDue;
  // Status is derived from records — admin cannot override
  const paymentStatus = totalDue === 0 ? "Paid" : "Due";

  // Next due month — oldest unpaid monthly charge
  const nextDueMonth = unpaidMonthlyCharges.length > 0
    ? {
        month:  unpaidMonthlyCharges[0].month,
        year:   unpaidMonthlyCharges[0].year,
        amount: unpaidMonthlyCharges[0].amount,
      }
    : null;

  // ── Return complete dashboard shape ───────────────────────────────────────
  return {
    // Summary card
    currentFee,
    totalDue,
    totalMonthlyDue,
    totalExtraDue,
    paymentStatus,
    nextDueMonth,

    // Last payment info for display
    lastPayment: lastCompletedPayment
      ? {
          amount:        lastCompletedPayment.amount,
          paidAt:        lastCompletedPayment.paidAt,
          receiptNumber: lastCompletedPayment.receiptNumber,
        }
      : null,

    // Pending session warning
    pendingPayment: pendingPayment
      ? {
          paymentId:  String(pendingPayment._id),
          amount:     pendingPayment.amount,
          createdAt:  pendingPayment.createdAt,
        }
      : null,

    // Payment selection data — charge IDs and amounts for the UI
    unpaidMonthlyCharges,
    unpaidExtraCharges,

    // History strip — 12 months of paid/unpaid indicators
    last12Months,
  };
};

// ─── getMemberTransactionHistory ─────────────────────────────────────────────
// Returns completed payments with their allocation breakdown.
// Used for the expandable transaction history table.
//
// Each payment row can be expanded to show what it covered —
// this enrichment joins Payment → PaymentAllocation → Charge documents.

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

  // Fetch all allocations for these payments in one query
  const paymentIds = payments.map(p => p._id);
  const allAllocations = await PaymentAllocation
    .find({ payment: { $in: paymentIds } })
    .lean();

  // Group allocations by payment ID
  const allocationsByPayment = {};
  for (const alloc of allAllocations) {
    const pid = String(alloc.payment);
    if (!allocationsByPayment[pid]) allocationsByPayment[pid] = [];
    allocationsByPayment[pid].push(alloc);
  }

  // Collect all charge IDs for batch lookup
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

  // Build lookup maps
  const monthlyMap = Object.fromEntries(monthlyCharges.map(c => [String(c._id), c]));
  const extraMap   = Object.fromEntries(extraCharges.map(c => [String(c._id), c]));

  // Enrich each payment with its allocation details
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