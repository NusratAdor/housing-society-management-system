// server/services/reportService.js
//
// Generates the raw data objects that both PDF and CSV renderers consume.
// Pure data functions — no HTTP, no PDF, no CSV concern here.
// The PDF builder and CSV builder each call these functions and format
// the data in their own way.
//
// All data comes from source records (Payment, PaymentAllocation,
// MonthlyCharge, ExtraCharge) — never from stored summary fields.
// This means every exported report is always financially accurate.

import mongoose          from "mongoose";
import Member            from "../models/Member.js";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import ExtraCharge       from "../models/ExtraCharge.js";
import { getMemberDueBreakdown } from "./paymentService.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April",
  "May", "June", "July", "August", "September",
  "October", "November", "December",
];

// ─── getMemberReportData ──────────────────────────────────────────────────────
// Returns structured transaction data for a single member.
// Used by: member PDF report, member CSV export.
//
// Parameters:
//   memberId  — MongoDB _id
//   startDate — Date (inclusive)
//   endDate   — Date (inclusive, set to end of day)
//
// Returns:
//   member            — member profile
//   payments          — completed payments in range with allocation breakdown
//   summary           — totals for the period
//   currentDueBreakdown — live due snapshot at time of export

export const getMemberReportData = async ({
  memberId,
  startDate,
  endDate,
}) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  // Normalise end date to end of day so "up to 31 March" includes all of March
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch member profile and completed payments in parallel
  const [member, payments, dueBreakdown] = await Promise.all([
    Member.findById(memberObjectId).lean(),

    Payment.find({
      member:  memberObjectId,
      status:  "completed",
      paidAt:  { $gte: startDate, $lte: endOfDay },
    })
      .sort({ paidAt: 1 })
      .lean(),

    getMemberDueBreakdown(memberObjectId),
  ]);

  if (!member) throw new Error("Member not found");

  // Enrich each payment with its allocation breakdown
  // Single batch query — not N queries
  const paymentIds = payments.map(p => p._id);

  const allAllocations = paymentIds.length > 0
    ? await PaymentAllocation.find({ payment: { $in: paymentIds } }).lean()
    : [];

  // Group allocations by payment
  const allocByPayment = {};
  for (const alloc of allAllocations) {
    const pid = String(alloc.payment);
    if (!allocByPayment[pid]) allocByPayment[pid] = [];
    allocByPayment[pid].push(alloc);
  }

  // Collect all charge IDs for batch fetch
  const monthlyChargeIds = allAllocations
    .filter(a => a.chargeType === "monthly")
    .map(a => a.chargeId);
  const extraChargeIds = allAllocations
    .filter(a => a.chargeType === "extra")
    .map(a => a.chargeId);

  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyChargeIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyChargeIds } }).lean()
      : [],
    extraChargeIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraChargeIds } }).lean()
      : [],
  ]);

  const monthlyMap = Object.fromEntries(monthlyCharges.map(c => [String(c._id), c]));
  const extraMap   = Object.fromEntries(extraCharges.map(c => [String(c._id), c]));

  // Build enriched payment objects
  const enrichedPayments = payments.map(payment => {
    const allocations = allocByPayment[String(payment._id)] || [];

    const breakdown = allocations.map(alloc => {
      if (alloc.chargeType === "monthly") {
        const charge = monthlyMap[String(alloc.chargeId)];
        return charge ? {
          type:        "monthly",
          description: `Monthly Maintenance — ${MONTH_NAMES[charge.month]} ${charge.year}`,
          month:       charge.month,
          year:        charge.year,
          amount:      alloc.amount,
        } : null;
      } else {
        const charge = extraMap[String(alloc.chargeId)];
        return charge ? {
          type:        "extra",
          description: charge.label,
          purpose:     charge.purpose,
          amount:      alloc.amount,
        } : null;
      }
    }).filter(Boolean);

    return { ...payment, breakdown };
  });

  // Compute period summary
  const totalPaid        = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalMonthly     = allAllocations
    .filter(a => a.chargeType === "monthly")
    .reduce((sum, a) => sum + a.amount, 0);
  const totalExtra       = allAllocations
    .filter(a => a.chargeType === "extra")
    .reduce((sum, a) => sum + a.amount, 0);

  return {
    member,
    payments: enrichedPayments,
    summary: {
      totalPaid,
      totalMonthly,
      totalExtra,
      paymentCount:  payments.length,
      periodStart:   startDate,
      periodEnd:     endOfDay,
    },
    currentDueBreakdown: dueBreakdown,
  };
};

// ─── getAdminReportData ───────────────────────────────────────────────────────
// Returns society-wide payment data for a date range.
// Used by: admin PDF report, admin CSV export.
//
// Returns:
//   payments     — all completed payments in range, grouped by member
//   summary      — society-level totals
//   memberRows   — flat per-member summary (for table in PDF / rows in CSV)

export const getAdminReportData = async ({ startDate, endDate }) => {
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  const payments = await Payment
    .find({
      status: "completed",
      paidAt: { $gte: startDate, $lte: endOfDay },
    })
    .populate("member", "name email membershipNo plotNo")
    .sort({ paidAt: 1 })
    .lean();

  // Per-member aggregation
  const memberTotals = {};
  for (const payment of payments) {
    const memberId = String(payment.member?._id || payment.member);
    if (!memberTotals[memberId]) {
      memberTotals[memberId] = {
        member:       payment.member,
        totalPaid:    0,
        paymentCount: 0,
        payments:     [],
      };
    }
    memberTotals[memberId].totalPaid    += payment.amount;
    memberTotals[memberId].paymentCount += 1;
    memberTotals[memberId].payments.push(payment);
  }

  const memberRows = Object.values(memberTotals)
    .sort((a, b) => (b.totalPaid - a.totalPaid));

  const totalCollection = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    payments,
    memberRows,
    summary: {
      totalCollection,
      totalPayments:    payments.length,
      membersWhoPayd:   memberRows.length,
      periodStart:      startDate,
      periodEnd:        endOfDay,
    },
  };
};

// ─── getSingleReceiptData ─────────────────────────────────────────────────────
// Returns data for one payment receipt.
// Used by the "Download Receipt" button on individual transactions.

export const getSingleReceiptData = async ({ paymentId, memberId }) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
  const memberObjectId  = new mongoose.Types.ObjectId(memberId);

  const [payment, member] = await Promise.all([
    Payment.findOne({ _id: paymentObjectId, member: memberObjectId }).lean(),
    Member.findById(memberObjectId).lean(),
  ]);

  if (!payment) throw new Error("Payment not found or does not belong to member");
  if (!member)  throw new Error("Member not found");

  if (payment.status !== "completed") {
    throw new Error("Receipts can only be generated for completed payments");
  }

  const allocations = await PaymentAllocation
    .find({ payment: paymentObjectId })
    .lean();

  const monthlyIds = allocations.filter(a => a.chargeType === "monthly").map(a => a.chargeId);
  const extraIds   = allocations.filter(a => a.chargeType === "extra").map(a => a.chargeId);

  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyIds } }).lean()
      : [],
    extraIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraIds } }).lean()
      : [],
  ]);

  const monthlyMap = Object.fromEntries(monthlyCharges.map(c => [String(c._id), c]));
  const extraMap   = Object.fromEntries(extraCharges.map(c => [String(c._id), c]));

  const lineItems = allocations.map(alloc => {
    if (alloc.chargeType === "monthly") {
      const c = monthlyMap[String(alloc.chargeId)];
      return c ? {
        type:        "monthly",
        description: `Monthly Maintenance — ${MONTH_NAMES[c.month]} ${c.year}`,
        amount:      alloc.amount,
      } : null;
    } else {
      const c = extraMap[String(alloc.chargeId)];
      return c ? {
        type:        "extra",
        description: c.label,
        purpose:     c.purpose,
        amount:      alloc.amount,
      } : null;
    }
  }).filter(Boolean);

  // Sort monthly items chronologically, extras after
  lineItems.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "monthly" ? -1 : 1;
  });

  return { payment, member, lineItems };
};