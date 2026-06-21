// server/services/paymentService.js
//
// Core financial query service. The single source of truth for what a member
// owes and what they have paid.
//
// The fundamental principle: NOTHING is stored. Everything is computed from
// MonthlyCharge, ExtraCharge, and PaymentAllocation records.
//
// This means:
//   - Due amount cannot drift out of sync — it IS the records
//   - Fee changes automatically reflect — historical charges already have
//     the correct locked amount from when they were created
//   - Admin cannot override payment status — it is mathematics
//   - Any point-in-time financial state can be reconstructed

import mongoose         from "mongoose";
import MonthlyCharge    from "../models/MonthlyCharge.js";
import ExtraCharge      from "../models/ExtraCharge.js";
import Payment          from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import { getCurrentFee } from "./feeService.js";

// ─── getMemberDueBreakdown ────────────────────────────────────────────────────
// The core financial query. Returns everything the member dashboard
// payment section needs in a single service call.
//
// All queries run in parallel with Promise.all — total latency equals
// the slowest single query, not the sum of all queries.
//
// Returns:
//   currentFee           — fee active right now (for UI display)
//   unpaidMonthlyCharges — FIFO-ordered unpaid monthly charges
//   unpaidExtraCharges   — unpaid extra charges, oldest first
//   last12Months         — 12-month history strip data
//   totalMonthlyDue      — sum of unpaid monthly charges
//   totalExtraDue        — sum of unpaid extra charges
//   totalDue             — total outstanding amount
//   paymentStatus        — "Paid" | "Due" (computed, never stored)
//   nextDueMonth         — the oldest unpaid month (for dashboard display)
//   lastPayment          — most recent completed payment record

export const getMemberDueBreakdown = async (memberId) => {
  // Always cast to ObjectId — aggregate pipelines require it explicitly
  // even though find() queries handle string IDs automatically
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  // Run all independent queries simultaneously
  const [
    unpaidMonthlyCharges,
    unpaidExtraCharges,
    last12Months,
    lastPayment,
    currentFee,
  ] = await Promise.all([

    // Unpaid monthly charges in FIFO order (January before February etc.)
    // This ordering is critical — it determines which months the
    // payment UI shows first and which the FIFO validator enforces
    MonthlyCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ year: 1, month: 1 })
      .lean(),

    // Unpaid extra charges, oldest first
    // Extra charges can be paid in any order (no FIFO requirement)
    // but oldest-first is the most sensible default display order
    ExtraCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ createdAt: 1 })
      .lean(),

    // Last 12 monthly charges regardless of status (for history strip)
    // Most recent first so the strip shows latest months on the left
    MonthlyCharge
      .find({ member: memberObjectId })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean(),

    // Most recent completed payment (for "Last Payment" display on dashboard)
    Payment
      .findOne({ member: memberObjectId, status: "completed" })
      .sort({ paidAt: -1 })
      .lean(),

    // Current fee for display only — charges already have their locked amounts
    getCurrentFee(),
  ]);

  // Compute totals from actual records — no stored field consulted
  const totalMonthlyDue = unpaidMonthlyCharges.reduce(
    (sum, charge) => sum + charge.amount, 0
  );
  const totalExtraDue = unpaidExtraCharges.reduce(
    (sum, charge) => sum + charge.amount, 0
  );
  const totalDue = totalMonthlyDue + totalExtraDue;

  // Payment status is a derived fact, not a stored field
  // Admin has zero ability to override this — it is computed
  const paymentStatus = totalDue === 0 ? "Paid" : "Due";

  // Next due month — the oldest unpaid monthly charge
  // null if all months are paid
  const nextDueMonth = unpaidMonthlyCharges.length > 0
    ? { month: unpaidMonthlyCharges[0].month, year: unpaidMonthlyCharges[0].year }
    : null;

  return {
    currentFee,
    unpaidMonthlyCharges,
    unpaidExtraCharges,
    last12Months,
    totalMonthlyDue,
    totalExtraDue,
    totalDue,
    paymentStatus,
    nextDueMonth,
    lastPayment,
  };
};

// ─── getMemberPaymentHistory ──────────────────────────────────────────────────
// Returns completed/failed/rejected payments for the transaction history table.
// Excludes pending payments — those are not settled and should not appear
// in the member's transaction history until confirmed.

export const getMemberPaymentHistory = async (memberId, limit = 50) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const payments = await Payment
    .find({
      member: memberObjectId,
      status: { $in: ["completed", "failed", "rejected"] },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return payments;
};

// ─── getPaymentAllocationDetails ─────────────────────────────────────────────
// Returns the allocation breakdown for a specific payment.
// Used for receipt generation — shows exactly what a payment covered.
// Example: "Payment of ৳1300 covered: Jan(500) + Feb(500) + Generator(300)"

export const getPaymentAllocationDetails = async (paymentId) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);

  const allocations = await PaymentAllocation
    .find({ payment: paymentObjectId })
    .lean();

  if (allocations.length === 0) return { allocations: [], monthly: [], extra: [] };

  // Separate allocations by type for structured display
  const monthlyAllocationIds = allocations
    .filter(a => a.chargeType === "monthly")
    .map(a => a.chargeId);

  const extraAllocationIds = allocations
    .filter(a => a.chargeType === "extra")
    .map(a => a.chargeId);

  // Fetch the actual charge documents to get labels and months
  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyAllocationIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyAllocationIds } }).lean()
      : [],
    extraAllocationIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraAllocationIds } }).lean()
      : [],
  ]);

  // Build indexed maps for O(1) lookup
  const monthlyMap = Object.fromEntries(monthlyCharges.map(c => [String(c._id), c]));
  const extraMap   = Object.fromEntries(extraCharges.map(c => [String(c._id), c]));

  // Enrich each allocation with its charge details
  const enriched = allocations.map(allocation => {
    if (allocation.chargeType === "monthly") {
      const charge = monthlyMap[String(allocation.chargeId)];
      return {
        ...allocation,
        chargeDetails: charge
          ? { month: charge.month, year: charge.year, amount: charge.amount }
          : null,
      };
    } else {
      const charge = extraMap[String(allocation.chargeId)];
      return {
        ...allocation,
        chargeDetails: charge
          ? { label: charge.label, purpose: charge.purpose, amount: charge.amount }
          : null,
      };
    }
  });

  return {
    allocations: enriched,
    monthly: enriched.filter(a => a.chargeType === "monthly"),
    extra:   enriched.filter(a => a.chargeType === "extra"),
  };
};

// ─── getMemberDueSummary ──────────────────────────────────────────────────────
// Lightweight version — returns only totalDue and paymentStatus.
// Used by the cron job due reminder (Step 3) and admin member list
// where the full breakdown is not needed.
// Much cheaper than getMemberDueBreakdown() — only two aggregate queries.

export const getMemberDueSummary = async (memberId) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const [monthlyAgg, extraAgg] = await Promise.all([
    MonthlyCharge.aggregate([
      { $match: { member: memberObjectId, status: "Unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ExtraCharge.aggregate([
      { $match: { member: memberObjectId, status: "Unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const totalMonthlyDue = monthlyAgg[0]?.total || 0;
  const totalExtraDue   = extraAgg[0]?.total   || 0;
  const totalDue        = totalMonthlyDue + totalExtraDue;

  return {
    totalDue,
    totalMonthlyDue,
    totalExtraDue,
    paymentStatus: totalDue === 0 ? "Paid" : "Due",
  };
};

// ─── getAllMembersDueSummary ───────────────────────────────────────────────────
// Returns due summaries for ALL members in two aggregate queries.
// Used by admin dashboard metrics (Step 10).
//
// Why two aggregates and not N calls to getMemberDueSummary():
//   For 500 members, N calls = 1000 DB round trips (2 aggregates × 500).
//   Two aggregates = 2 DB round trips total, regardless of member count.
//   The aggregation groups by member — one query handles all 500.

export const getAllMembersDueSummary = async () => {
  const [monthlyAgg, extraAgg] = await Promise.all([
    MonthlyCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", totalMonthly: { $sum: "$amount" } } },
    ]),
    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", totalExtra: { $sum: "$amount" } } },
    ]),
  ]);

  // Merge the two results by member _id
  const monthlyMap = Object.fromEntries(
    monthlyAgg.map(r => [String(r._id), r.totalMonthly])
  );
  const extraMap = Object.fromEntries(
    extraAgg.map(r => [String(r._id), r.totalExtra])
  );

  // Build the complete set of all member IDs that appear in either result
  const allMemberIds = new Set([
    ...Object.keys(monthlyMap),
    ...Object.keys(extraMap),
  ]);

  const summaries = [];
  let totalOutstanding = 0;
  let membersWithDues  = 0;

  for (const memberId of allMemberIds) {
    const monthly = monthlyMap[memberId] || 0;
    const extra   = extraMap[memberId]   || 0;
    const total   = monthly + extra;

    summaries.push({
      memberId,
      totalMonthlyDue: monthly,
      totalExtraDue:   extra,
      totalDue:        total,
      paymentStatus:   total === 0 ? "Paid" : "Due",
    });

    totalOutstanding += total;
    if (total > 0) membersWithDues++;
  }

  return { summaries, totalOutstanding, membersWithDues };
};