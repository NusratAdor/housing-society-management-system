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

import { getMemberDueBreakdown, getMemberDueSummary } from "./paymentService.js";
import { getMemberCreditBalance, getCreditBalanceMap } from "./creditService.js";
import { getDirectAllocations, buildAdvanceItem } from "../utils/paymentBreakdown.js";
import { getStartOfDhakaMonth } from "../utils/dateTime.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatPlots = (plots = []) =>
  Array.isArray(plots) && plots.length > 0
    ? plots.map((p) => `${p.plotNo} (${p.plotSize} )`).join(", ")
    : "-";

const totalPlotArea = (plots = []) =>
  Number(plots.reduce((sum, p) => sum + Number(p?.plotSize || 0), 0).toFixed(2));



// Months paid from existing credit = allocations that are NOT part of the
// payment's own selected charges (those were paid by that payment's cash).
// PaymentAllocation is the financial evidence; AuditLog only records who/when.
const deriveCreditApplications = ({ allocations, paymentById, monthlyById }) => {
  const byCharge = new Map();

  for (const a of allocations) {
    const payment = paymentById.get(String(a.payment));
    if (!payment || !(payment.advanceAmount > 0)) continue;

    const own = new Set(
      [...(payment.pendingMonthlyIds || []), ...(payment.pendingExtraIds || [])].map(String),
    );
    if (own.has(String(a.chargeId))) continue;

    const key = String(a.chargeId);
    const entry = byCharge.get(key) || { chargeId: key, amount: 0, at: a.allocatedAt };
    entry.amount += a.amount;
    if (a.allocatedAt > entry.at) entry.at = a.allocatedAt;
    byCharge.set(key, entry);
  }

  return [...byCharge.values()].map((entry) => {
    const charge = monthlyById.get(entry.chargeId);
    return { ...entry, month: charge?.month, year: charge?.year };
  });
};

// ─── getMemberReportData ──────────────────────────────────────────────────────

export const getMemberReportData = async ({ memberId, startDate, endDate }) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  // endDate is already the last millisecond of the end day in Dhaka (reportController).
  const endOfDay = endDate;

  const [member, payments, dueBreakdown, creditBalance, periodAllocations] =
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

      PaymentAllocation.find({
        member: memberObjectId,
        allocatedAt: { $gte: startDate, $lte: endOfDay },
      })
        .select("payment chargeId amount allocatedAt")
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

 

  return {
    member: { ...member, plotsLabel: formatPlots(member.plots) },
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

// ─── getAdminReportData (Collection & Payments) ───────────────────────────────
// Collection = cash received (completed Payment.amount). Each payment is split
// into monthly / extra / advance from its own direct allocations; credit applied
// later never creates a Payment, so it is never counted twice.

export const getAdminReportData = async ({ startDate, endDate }) => {
  const endOfDay = endDate; // already the last millisecond of the Dhaka end day

  const payments = await Payment.find({
    status: "completed",
    paidAt: { $gte: startDate, $lte: endOfDay },
  })
    .populate("member", "name email membershipNo plots")
    .sort({ paidAt: 1 })
    .lean();

  const allocations =
    payments.length > 0
      ? await PaymentAllocation.find({ payment: { $in: payments.map((p) => p._id) } })
          .select("payment chargeType chargeId amount")
          .lean()
      : [];

  const allocByPayment = new Map();
  for (const a of allocations) {
    const key = String(a.payment);
    if (!allocByPayment.has(key)) allocByPayment.set(key, []);
    allocByPayment.get(key).push(a);
  }

  const memberTotals = new Map();
  let totalCollection = 0, totalMonthly = 0, totalExtra = 0, totalAdvance = 0;

  for (const payment of payments) {
    const direct = getDirectAllocations(payment, allocByPayment.get(String(payment._id)) || []);
    payment.monthlyApplied = direct
      .filter((a) => a.chargeType === "monthly")
      .reduce((s, a) => s + a.amount, 0);
    payment.extraApplied = direct
      .filter((a) => a.chargeType === "extra")
      .reduce((s, a) => s + a.amount, 0);
    payment.advanceAmount = payment.advanceAmount || 0;

    totalCollection += payment.amount;
    totalMonthly += payment.monthlyApplied;
    totalExtra += payment.extraApplied;
    totalAdvance += payment.advanceAmount;

    const memberId = String(payment.member?._id || payment.member);
    if (!memberTotals.has(memberId)) {
      memberTotals.set(memberId, {
        member: payment.member,
        totalPaid: 0,
        duesApplied: 0,
        advanceTotal: 0,
        paymentCount: 0,
      });
    }
    const row = memberTotals.get(memberId);
    row.totalPaid += payment.amount;
    row.advanceTotal += payment.advanceAmount;
    row.duesApplied += payment.amount - payment.advanceAmount;
    row.paymentCount += 1;
  }

  const memberRows = [...memberTotals.values()].sort((a, b) => b.totalPaid - a.totalPaid);

  return {
    payments,
    memberRows,
    summary: {
      totalCollection,
      totalMonthly,
      totalExtra,
      totalAdvance,
      totalDuesApplied: totalCollection - totalAdvance,
      totalPayments: payments.length,
      membersWhoPaid: memberRows.length,
      periodStart: startDate,
      periodEnd: endOfDay,
    },
  };
};

// ─── getMemberDirectoryData ───────────────────────────────────────────────────

export const getMemberDirectoryData = async ({ status = "active" } = {}) => {
  const filter = status === "all" ? {} : { status: status === "removed" ? "removed" : "active" };

  const members = await Member.find(filter)
    .select("name phone email designation membershipNo plots status createdAt")
    .lean();

  members.sort((a, b) =>
    String(a.membershipNo).localeCompare(String(b.membershipNo), undefined, { numeric: true }),
  );

  const rows = members.map((m) => ({
    membershipNo: m.membershipNo,
    name: m.name,
    phone: m.phone,
    email: m.email,
    designation: m.designation,
    status: m.status,
    plotCount: m.plots?.length || 0,
    totalArea: totalPlotArea(m.plots),
    plots: m.plots || [],
    plotsLabel: formatPlots(m.plots),
    registeredAt: m.createdAt,
  }));

  return {
    rows,
    summary: {
      status,
      totalMembers: rows.length,
      totalPlots: rows.reduce((s, r) => s + r.plotCount, 0),
      totalArea: Number(rows.reduce((s, r) => s + r.totalArea, 0).toFixed(2)),
    },
  };
};

// ─── getOutstandingDuesData ───────────────────────────────────────────────────
// Active members with unpaid charges. Credit is shown SEPARATELY and never
// subtracted: a due of ৳400 with ৳300 credit is "due ৳400, credit ৳300".

export const getOutstandingDuesData = async () => {
  const [members, monthlyAgg, extraAgg, creditMap] = await Promise.all([
    Member.find({ status: "active" }).select("name phone membershipNo").lean(),
    MonthlyCharge.aggregate([
      { $match: { status: "Unpaid" } },
      {
        $group: {
          _id: "$member",
          due: { $sum: "$amount" },
          count: { $sum: 1 },
          oldestKey: { $min: { $add: [{ $multiply: ["$year", 12] }, "$month"] } },
        },
      },
    ]),
    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", due: { $sum: "$amount" } } },
    ]),
    getCreditBalanceMap(),
  ]);

  const monthlyBy = new Map(monthlyAgg.map((r) => [String(r._id), r]));
  const extraBy = new Map(extraAgg.map((r) => [String(r._id), r.due]));

  const rows = [];
  for (const m of members) {
    const id = String(m._id);
    const monthly = monthlyBy.get(id);
    const monthlyDue = monthly?.due || 0;
    const extraDue = extraBy.get(id) || 0;
    const totalDue = monthlyDue + extraDue;
    if (totalDue === 0) continue;

    const idx = monthly ? monthly.oldestKey - 1 : null;
    rows.push({
      memberId: id,
      membershipNo: m.membershipNo,
      name: m.name,
      phone: m.phone,
      monthlyDue,
      extraDue,
      totalDue,
      unpaidMonths: monthly?.count || 0,
      oldestUnpaid: monthly ? { year: Math.floor(idx / 12), month: (idx % 12) + 1 } : null,
      creditBalance: creditMap.get(id) || 0,
    });
  }

  rows.sort(
    (a, b) =>
      b.totalDue - a.totalDue ||
      String(a.membershipNo).localeCompare(String(b.membershipNo), undefined, { numeric: true }),
  );

  return {
    rows,
    summary: {
      membersWithDues: rows.length,
      totalMonthly: rows.reduce((s, r) => s + r.monthlyDue, 0),
      totalExtra: rows.reduce((s, r) => s + r.extraDue, 0),
      totalOutstanding: rows.reduce((s, r) => s + r.totalDue, 0),
    },
  };
};

// ─── getMemberStatementData ───────────────────────────────────────────────────
// One ledger from existing records. Three kinds of line:
//   charge   → due ↑
//   payment  → cash in; (amount − advance) reduces due; advance goes to credit
//   credit   → earlier credit paid a month: due ↓ and credit ↓ (no new cash)

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const getMemberStatementData = async ({ memberId, startDate, endDate }) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const [member, monthly, extra, payments, allocations, creditNow, dueNow] = await Promise.all([
    Member.findById(memberObjectId)
      .select("name phone membershipNo designation plots status")
      .lean(),
    MonthlyCharge.find({ member: memberObjectId }).select("month year amount").lean(),
    ExtraCharge.find({ member: memberObjectId, status: { $ne: "Cancelled" } })
      .select("label amount createdAt")
      .lean(),
    Payment.find({ member: memberObjectId, status: "completed" })
      .select("amount advanceAmount receiptNumber paidAt pendingMonthlyIds pendingExtraIds")
      .lean(),
    PaymentAllocation.find({ member: memberObjectId })
      .select("payment chargeId amount allocatedAt")
      .lean(),
    getMemberCreditBalance(memberObjectId),
    getMemberDueSummary(memberObjectId),
  ]);

  if (!member) throw new Error("Member not found");

  const events = [];

  for (const c of monthly) {
    events.push({
      at: getStartOfDhakaMonth(c.year, c.month),
      order: 0,
      description: `Monthly fee - ${MONTH_NAMES[c.month]} ${c.year}`,
      charge: c.amount,
    });
  }
  for (const c of extra) {
    events.push({ at: c.createdAt, order: 0, description: c.label, charge: c.amount });
  }

  for (const p of payments) {
    const toCredit = p.advanceAmount || 0;
    const applied = p.amount - toCredit;
    events.push({
      at: p.paidAt,
      order: 1,
      description: `Payment ${p.receiptNumber || ""}`.trim(),
      note:
        toCredit > 0
          ? applied > 0
            ? `Applied to charges ${applied.toLocaleString("en-US")} | Added to credit ${toCredit.toLocaleString("en-US")}`
            : `Added to credit balance ${toCredit.toLocaleString("en-US")}`
          : undefined,
      cash: p.amount,
      cashToCredit: toCredit,
      dueDelta: -applied,
      creditDelta: toCredit,
    });
  }

  const paymentById = new Map(payments.map((p) => [String(p._id), p]));
  const monthlyById = new Map(monthly.map((c) => [String(c._id), c]));

  for (const app of deriveCreditApplications({ allocations, paymentById, monthlyById })) {
    events.push({
      at: app.at,
      order: 2,
      description: app.month
        ? `Credit applied - ${MONTH_NAMES[app.month]} ${app.year}`
        : "Credit applied",
      creditUsed: app.amount,
      dueDelta: -app.amount,
      creditDelta: -app.amount,
    });
  }

  events.sort((a, b) => a.at - b.at || a.order - b.order);

  let due = 0;
  let credit = 0;
  const step = (e) => {
    due += (e.charge || 0) + (e.dueDelta || 0);
    credit += e.creditDelta || 0;
  };

  let index = 0;
  while (index < events.length && events[index].at < startDate) step(events[index++]);

  const openingDue = round2(due);
  const openingCredit = round2(credit);
  const totals = { charges: 0, cash: 0, cashToCredit: 0, creditUsed: 0 };
  const rows = [];

  for (; index < events.length && events[index].at <= endDate; index++) {
    const e = events[index];
    step(e);
    totals.charges += e.charge || 0;
    totals.cash += e.cash || 0;
    totals.cashToCredit += e.cashToCredit || 0;
    totals.creditUsed += e.creditUsed || 0;

    rows.push({
      date: e.at,
      description: e.description,
      note: e.note,
      charge: e.charge || 0,
      cash: e.cash || 0,
      creditUsed: e.creditUsed || 0,
      due: round2(due),
      creditBalance: round2(credit),
    });
  }

  // Reconciliation control: when the period reaches today, the ledger must agree
  // with the live account (unpaid charges and credit deposits). A difference
  // means a record was changed outside the normal flow: say so, don't hide it.
  const reachesToday = endDate >= new Date();
  const dueDifference = round2(due - dueNow.totalDue);
  const creditDifference = round2(credit - creditNow);
  const reconciled = Math.abs(dueDifference) < 0.01 && Math.abs(creditDifference) < 0.01;

  if (reachesToday && !reconciled) {
    console.error(
      `[Statement] Ledger does not reconcile for member ${memberId}: ` +
        `due difference ${dueDifference}, credit difference ${creditDifference}`,
    );
  }

  return {
    member: { ...member, plotsLabel: formatPlots(member.plots) },
    rows,
    summary: {
      periodStart: startDate,
      periodEnd: endDate,
      openingDue,
      openingCredit,
      charges: round2(totals.charges),
      cash: round2(totals.cash),
      cashToCredit: round2(totals.cashToCredit),
      cashApplied: round2(totals.cash - totals.cashToCredit),
      creditUsed: round2(totals.creditUsed),
      closingDue: round2(due),
      closingCredit: round2(credit),
      currentDue: dueNow.totalDue,
      currentCredit: creditNow,
      reconciliation: {
        checked: reachesToday,
        ok: !reachesToday || reconciled,
        dueDifference,
        creditDifference,
      },
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
    member: { ...member, plotsLabel: formatPlots(member.plots) },
    lineItems,
  };
};