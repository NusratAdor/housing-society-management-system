// server/services/reportService.js
//
// Builds the data objects the PDF and CSV renderers consume.
//
// CHANGE (this pass):
//   - Plots: Member has a `plots` array (no `plotNo`). A readable
//     `plotsLabel` is attached to every member object returned.
//   - Each payment now carries monthlyApplied / extraApplied /
//     advanceAmount / covers, so one payment = one row everywhere and
//     received = monthly + extra + advance always holds.
//   - summary now includes totalAdvance (it was calculated but never
//     returned), plus credit-applied history and the current credit balance.
//   - Credit applied to charges is NOT new cash. It is read from the
//     PAYMENT_CREDIT_APPLIED audit entries and reported separately.
//   - Existing return shapes are preserved (fields were only added).

import mongoose from "mongoose";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge from "../models/ExtraCharge.js";
import AuditLog from "../models/AuditLog.js";
import { getMemberDueBreakdown } from "./paymentService.js";
import { getMemberCreditBalance } from "./creditService.js";
import {
  getDirectAllocations,
  buildAdvanceItem,
} from "../utils/paymentBreakdown.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatPlots = (member) => {
  const plots = Array.isArray(member?.plots) ? member.plots : [];
  if (plots.length === 0) return "-";
  return plots.map((p) => `${p.plotNo} (${p.plotSize} Katha)`).join(", ");
};

// ─── getMemberReportData ──────────────────────────────────────────────────────

export const getMemberReportData = async ({ memberId, startDate, endDate }) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

    // endDate is already the last millisecond of the end day in Dhaka (reportController).
  const endOfDay = endDate;

  const [member, payments, dueBreakdown, creditBalance, creditAudits] =
    await Promise.all([
      Member.findById(memberObjectId).lean(),

      Payment.find({
        member: memberObjectId,
        status: "completed",
        paidAt: { $gte: startDate, $lte: endOfDay },
      })
        .sort({ paidAt: 1 })
        .lean(),

      getMemberDueBreakdown(memberObjectId),

      getMemberCreditBalance(memberObjectId),

      // Existing credit used to clear a monthly charge (no new cash).
      AuditLog.find({
        action: "PAYMENT_CREDIT_APPLIED",
        "metadata.memberId": String(memberObjectId),
        createdAt: { $gte: startDate, $lte: endOfDay },
      })
        .sort({ createdAt: 1 })
        .select("createdAt metadata")
        .lean(),
    ]);

  if (!member) throw new Error("Member not found");

  // One batch query for every allocation, not N queries.
  const paymentIds = payments.map((p) => p._id);

  const allAllocations =
    paymentIds.length > 0
      ? await PaymentAllocation.find({ payment: { $in: paymentIds } }).lean()
      : [];

  const allocByPayment = {};
  for (const alloc of allAllocations) {
    const pid = String(alloc.payment);
    if (!allocByPayment[pid]) allocByPayment[pid] = [];
    allocByPayment[pid].push(alloc);
  }

  const monthlyChargeIds = allAllocations
    .filter((a) => a.chargeType === "monthly")
    .map((a) => a.chargeId);
  const extraChargeIds = allAllocations
    .filter((a) => a.chargeType === "extra")
    .map((a) => a.chargeId);

  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyChargeIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyChargeIds } }).lean()
      : [],
    extraChargeIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraChargeIds } }).lean()
      : [],
  ]);

  const monthlyMap = Object.fromEntries(
    monthlyCharges.map((c) => [String(c._id), c]),
  );
  const extraMap = Object.fromEntries(
    extraCharges.map((c) => [String(c._id), c]),
  );

  const enrichedPayments = payments.map((payment) => {
    // Only the charges this payment's own cash cleared (not credit-funded ones).
    const allocations = getDirectAllocations(
      payment,
      allocByPayment[String(payment._id)] || [],
    );

    const monthlyItems = [];
    const extraItems = [];
    let monthlyApplied = 0;
    let extraApplied = 0;

    for (const alloc of allocations) {
      if (alloc.chargeType === "monthly") {
        monthlyApplied += alloc.amount;
        const charge = monthlyMap[String(alloc.chargeId)];
        if (charge) {
          monthlyItems.push({
            type: "monthly",
            description: `Monthly Maintenance — ${MONTH_NAMES[charge.month]} ${charge.year}`,
            month: charge.month,
            year: charge.year,
            amount: alloc.amount,
          });
        }
      } else {
        extraApplied += alloc.amount;
        const charge = extraMap[String(alloc.chargeId)];
        if (charge) {
          extraItems.push({
            type: "extra",
            description: charge.label,
            purpose: charge.purpose,
            amount: alloc.amount,
          });
        }
      }
    }

    monthlyItems.sort((a, b) => a.year - b.year || a.month - b.month);

    const advanceAmount = payment.advanceAmount || 0;

    const covers = [
      ...monthlyItems.map((i) => `${SHORT_MONTHS[i.month]} ${i.year}`),
      ...extraItems.map((i) => i.description),
      ...(advanceAmount > 0 ? ["Advance credit"] : []),
    ].join(", ");

    const advanceItem = buildAdvanceItem(payment);
    const breakdown = [...monthlyItems, ...extraItems];
    if (advanceItem) breakdown.push(advanceItem);

    return {
      ...payment,
      monthlyApplied,
      extraApplied,
      advanceAmount,
      covers,
      breakdown,
    };
  });

  const totalPaid = enrichedPayments.reduce((s, p) => s + p.amount, 0);
  const totalMonthly = enrichedPayments.reduce((s, p) => s + p.monthlyApplied, 0);
  const totalExtra = enrichedPayments.reduce((s, p) => s + p.extraApplied, 0);
  const totalAdvance = enrichedPayments.reduce((s, p) => s + p.advanceAmount, 0);

  const creditAppliedItems = creditAudits.map((a) => ({
    date: a.createdAt,
    month: a.metadata?.month,
    year: a.metadata?.year,
    amount: a.metadata?.amount || 0,
  }));

  return {
    member: { ...member, plotsLabel: formatPlots(member) },
    payments: enrichedPayments,
    summary: {
      totalPaid,
      totalMonthly,
      totalExtra,
      totalAdvance,
      paymentCount: enrichedPayments.length,
      periodStart: startDate,
      periodEnd: endOfDay,
      creditAppliedItems,
      creditAppliedTotal: creditAppliedItems.reduce((s, i) => s + i.amount, 0),
      creditBalance,
    },
    currentDueBreakdown: dueBreakdown,
  };
};

// ─── getAdminReportData ───────────────────────────────────────────────────────
// Collection = actual cash received. Split into "applied to dues" and
// "added to advance credit". Credit applied later is never counted again.

export const getAdminReportData = async ({ startDate, endDate }) => {
    const endOfDay = endDate;

  const payments = await Payment.find({
    status: "completed",
    paidAt: { $gte: startDate, $lte: endOfDay },
  })
    .populate("member", "name email membershipNo plots")
    .sort({ paidAt: 1 })
    .lean();

  const memberTotals = {};
  for (const payment of payments) {
    const memberId = String(payment.member?._id || payment.member);
    if (!memberTotals[memberId]) {
      memberTotals[memberId] = {
        member: payment.member,
        totalPaid: 0,
        duesApplied: 0,
        advanceTotal: 0,
        paymentCount: 0,
        payments: [],
      };
    }
    const advance = payment.advanceAmount || 0;
    const row = memberTotals[memberId];
    row.totalPaid += payment.amount;
    row.advanceTotal += advance;
    row.duesApplied += payment.amount - advance;
    row.paymentCount += 1;
    row.payments.push(payment);
  }

  const memberRows = Object.values(memberTotals).sort(
    (a, b) => b.totalPaid - a.totalPaid,
  );

  const totalCollection = payments.reduce((s, p) => s + p.amount, 0);
  const totalAdvance = payments.reduce((s, p) => s + (p.advanceAmount || 0), 0);

  return {
    payments,
    memberRows,
    summary: {
      totalCollection,
      totalAdvance,
      totalDuesApplied: totalCollection - totalAdvance,
      totalPayments: payments.length,
      membersWhoPayd: memberRows.length,
      periodStart: startDate,
      periodEnd: endOfDay,
    },
  };
};

// ─── getSingleReceiptData ─────────────────────────────────────────────────────

export const getSingleReceiptData = async ({ paymentId, memberId }) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const [payment, member] = await Promise.all([
    Payment.findOne({ _id: paymentObjectId, member: memberObjectId }).lean(),
    Member.findById(memberObjectId).lean(),
  ]);

  if (!payment) throw new Error("Payment not found or does not belong to member");
  if (!member) throw new Error("Member not found");

  if (payment.status !== "completed") {
    throw new Error("Receipts can only be generated for completed payments");
  }

  const allocations = getDirectAllocations(
    payment,
    await PaymentAllocation.find({ payment: paymentObjectId }).lean(),
  );

  const monthlyIds = allocations
    .filter((a) => a.chargeType === "monthly")
    .map((a) => a.chargeId);
  const extraIds = allocations
    .filter((a) => a.chargeType === "extra")
    .map((a) => a.chargeId);

  const [monthlyCharges, extraCharges] = await Promise.all([
    monthlyIds.length > 0
      ? MonthlyCharge.find({ _id: { $in: monthlyIds } }).lean()
      : [],
    extraIds.length > 0
      ? ExtraCharge.find({ _id: { $in: extraIds } }).lean()
      : [],
  ]);

  const monthlyMap = Object.fromEntries(
    monthlyCharges.map((c) => [String(c._id), c]),
  );
  const extraMap = Object.fromEntries(
    extraCharges.map((c) => [String(c._id), c]),
  );

  const lineItems = allocations
    .map((alloc) => {
      if (alloc.chargeType === "monthly") {
        const c = monthlyMap[String(alloc.chargeId)];
        return c
          ? {
              type: "monthly",
              description: `Monthly Maintenance — ${MONTH_NAMES[c.month]} ${c.year}`,
              month: c.month,
              year: c.year,
              amount: alloc.amount,
            }
          : null;
      }
      const c = extraMap[String(alloc.chargeId)];
      return c
        ? {
            type: "extra",
            description: c.label,
            purpose: c.purpose,
            amount: alloc.amount,
          }
        : null;
    })
    .filter(Boolean);

  // Monthly (oldest first), then extras.
  lineItems.sort((a, b) => {
    if (a.type !== b.type) return a.type === "monthly" ? -1 : 1;
    if (a.type === "monthly") return a.year - b.year || a.month - b.month;
    return 0;
  });

  const advanceItem = buildAdvanceItem(payment);
  if (advanceItem) lineItems.push(advanceItem);

  return {
    payment,
    member: { ...member, plotsLabel: formatPlots(member) },
    lineItems,
  };
};