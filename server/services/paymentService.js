// server/services/paymentService.js
//
// Core financial query service. The single source of truth for what a member
// owes and what they have paid.
//
// The fundamental principle: NOTHING is stored. Everything is computed from
// MonthlyCharge, ExtraCharge, and PaymentAllocation records.
//
// A monthly charge is either Unpaid or Paid — no partial state — so due
// calculations here are a straightforward sum of Unpaid charge amounts.

import mongoose          from "mongoose";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import ExtraCharge       from "../models/ExtraCharge.js";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import { getCurrentFee } from "./feeService.js";

// ─── getMemberDueBreakdown ────────────────────────────────────────────────

export const getMemberDueBreakdown = async (memberId) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const [
    unpaidMonthlyCharges,
    unpaidExtraCharges,
    last12Months,
    lastPayment,
    currentFee,
  ] = await Promise.all([

    MonthlyCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ year: 1, month: 1 })
      .lean(),

    ExtraCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ createdAt: 1 })
      .lean(),

    MonthlyCharge
      .find({ member: memberObjectId })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean(),

    Payment
      .findOne({ member: memberObjectId, status: "completed" })
      .sort({ paidAt: -1 })
      .lean(),

    getCurrentFee(),
  ]);

  const totalMonthlyDue = unpaidMonthlyCharges.reduce((sum, c) => sum + c.amount, 0);
  const totalExtraDue   = unpaidExtraCharges.reduce((sum, c) => sum + c.amount, 0);
  const totalDue         = totalMonthlyDue + totalExtraDue;

  const paymentStatus = totalDue === 0 ? "Paid" : "Due";

  const nextDueMonth = unpaidMonthlyCharges.length > 0
    ? {
        month:  unpaidMonthlyCharges[0].month,
        year:   unpaidMonthlyCharges[0].year,
        amount: unpaidMonthlyCharges[0].amount,
      }
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

// ─── getMemberPaymentHistory ──────────────────────────────────────────────
// UNCHANGED.

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

// ─── getPaymentAllocationDetails ──────────────────────────────────────────
// UNCHANGED.

export const getPaymentAllocationDetails = async (paymentId) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);

  const allocations = await PaymentAllocation
    .find({ payment: paymentObjectId })
    .lean();

  if (allocations.length === 0) return { allocations: [], monthly: [], extra: [] };

  const monthlyAllocationIds = allocations
    .filter(a => a.chargeType === "monthly")
    .map(a => a.chargeId);

  const extraAllocationIds = allocations
    .filter(a => a.chargeType === "extra")
    .map(a => a.chargeId);

  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyAllocationIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyAllocationIds } }).lean()
      : [],
    extraAllocationIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraAllocationIds } }).lean()
      : [],
  ]);

  const monthlyMap = Object.fromEntries(monthlyCharges.map(c => [String(c._id), c]));
  const extraMap   = Object.fromEntries(extraCharges.map(c => [String(c._id), c]));

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

// ─── getMemberDueSummary ──────────────────────────────────────────────────
// Lightweight version — only totalDue and paymentStatus.

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