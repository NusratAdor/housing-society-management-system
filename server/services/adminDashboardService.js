// server/services/adminDashboardService.js
//
// A monthly charge is either Unpaid or Paid — no partial state — so
// "who owes how much" is a plain sum of Unpaid charge amounts per member.
//
// CHANGE (this pass):
//   - "Today", "this month" and the 12-month trend use the DHAKA calendar
//     (they used the server timezone / UTC).
//   - The "Pending" card counts payments awaiting ADMIN CONFIRMATION
//     ("verified"), not gateway sessions ("pending").
//   - Outstanding totals count ACTIVE members only, matching the member counts.
//   - Extra-charge analytics exclude Cancelled charges from "charged".
//   - Collection = actual cash (completed Payment.amount); credit applied to a
//     month creates no Payment, so it is never counted twice.

import mongoose      from "mongoose";
import Member        from "../models/Member.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge   from "../models/ExtraCharge.js";
import Payment       from "../models/Payment.js";
import {
  getDhakaDateParts,
  getStartOfDhakaDay,
  getStartOfDhakaMonth,
} from "../utils/dateTime.js";

const TIMEZONE = "Asia/Dhaka";

// ─── getMonthlyDueByMemberMap ──────────────────────────────────────────────

const getMonthlyDueByMemberMap = async () => {
  const agg = await MonthlyCharge.aggregate([
    { $match: { status: "Unpaid" } },
    { $group: { _id: "$member", total: { $sum: "$amount" } } },
  ]);

  const dueByMember = {};
  for (const r of agg) dueByMember[String(r._id)] = r.total;
  return dueByMember;
};

const sumCompleted = (match = {}) =>
  Payment.aggregate([
    { $match: { status: "completed", ...match } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

// ─── getCollectionMetrics ─────────────────────────────────────────────────

export const getCollectionMetrics = async () => {
  const { year, month } = getDhakaDateParts();
  const startOfToday     = getStartOfDhakaDay();
  const startOfThisMonth = getStartOfDhakaMonth(year, month);

  const [
    allTimeAgg,
    thisMonthAgg,
    todayAgg,
    monthlyDueByMember,
    extraDueAgg,
    activeMemberIds,
  ] = await Promise.all([
    sumCompleted(),
    sumCompleted({ paidAt: { $gte: startOfThisMonth } }),
    sumCompleted({ paidAt: { $gte: startOfToday } }),
    getMonthlyDueByMemberMap(),
    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", total: { $sum: "$amount" } } },
    ]),
    Member.distinct("_id", { status: "active" }),
  ]);

  const activeSet = new Set(activeMemberIds.map(String));
  const membersWithDues = new Set();

  let outstandingMonthly = 0;
  for (const [memberId, total] of Object.entries(monthlyDueByMember)) {
    if (!activeSet.has(memberId)) continue;
    outstandingMonthly += total;
    membersWithDues.add(memberId);
  }

  let outstandingExtra = 0;
  for (const row of extraDueAgg) {
    const memberId = String(row._id);
    if (!activeSet.has(memberId)) continue;
    outstandingExtra += row.total;
    membersWithDues.add(memberId);
  }

  const totalMembers = activeMemberIds.length;

  return {
    totalCollection:     allTimeAgg[0]?.total  || 0,
    thisMonthCollection: thisMonthAgg[0]?.total || 0,
    todayCollection:     todayAgg[0]?.total     || 0,
    totalOutstanding:    outstandingMonthly + outstandingExtra,
    outstandingMonthly,
    outstandingExtra,
    membersWithDues:     membersWithDues.size,
    membersPaid:         totalMembers - membersWithDues.size,
    totalMembers,
  };
};

// ─── getMonthlyCollectionTrend ────────────────────────────────────────────
// Months are DHAKA calendar months: a payment at 02:00 Dhaka on the 1st belongs
// to that month even though it is still the previous month in UTC.

export const getMonthlyCollectionTrend = async (months = 12) => {
  const { year, month } = getDhakaDateParts();
  const cutoff = getStartOfDhakaMonth(year, month - months + 1);

  const trend = await Payment.aggregate([
    { $match: { status: "completed", paidAt: { $gte: cutoff } } },
    {
      $group: {
        _id: {
          year:  { $year:  { date: "$paidAt", timezone: TIMEZONE } },
          month: { $month: { date: "$paidAt", timezone: TIMEZONE } },
        },
        collected: { $sum: "$amount" },
        payments:  { $sum: 1 },
      },
    },
  ]);

  const byKey = new Map(trend.map((t) => [`${t._id.year}-${t._id.month}`, t]));

  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const index = year * 12 + (month - 1) - i;
    const targetYear = Math.floor(index / 12);
    const targetMonth = (index % 12) + 1;
    const found = byKey.get(`${targetYear}-${targetMonth}`);

    result.push({
      year:      targetYear,
      month:     targetMonth,
      collected: found?.collected || 0,
      payments:  found?.payments  || 0,
    });
  }

  return result;
};

// ─── getOutstandingMembersList ────────────────────────────────────────────

export const getOutstandingMembersList = async ({ page = 1, limit = 20 } = {}) => {
  const [monthlyDueByMember, extraDuePerMember, activeMemberIds] = await Promise.all([
    getMonthlyDueByMemberMap(),
    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", extraDue: { $sum: "$amount" } } },
    ]),
    Member.distinct("_id", { status: "active" }),
  ]);

  const activeIdSet = new Set(activeMemberIds.map(String));
  const dueMap = {};

  for (const [memberId, monthlyDue] of Object.entries(monthlyDueByMember)) {
    if (!activeIdSet.has(memberId)) continue;
    dueMap[memberId] = { ...dueMap[memberId], monthlyDue };
  }
  for (const r of extraDuePerMember) {
    const id = String(r._id);
    if (!activeIdSet.has(id)) continue;
    dueMap[id] = { ...dueMap[id], extraDue: r.extraDue };
  }

  const sorted = Object.entries(dueMap)
    .map(([memberId, dues]) => ({
      memberId,
      monthlyDue: dues.monthlyDue || 0,
      extraDue:   dues.extraDue   || 0,
      totalDue:   (dues.monthlyDue || 0) + (dues.extraDue || 0),
    }))
    .sort((a, b) => b.totalDue - a.totalDue);

  const total     = sorted.length;
  const pageItems = sorted.slice((page - 1) * limit, (page - 1) * limit + limit);

  const memberIds     = pageItems.map((item) => new mongoose.Types.ObjectId(item.memberId));
  const memberDetails = await Member
    .find({ _id: { $in: memberIds } })
    .select("name email membershipNo plots phone")
    .lean();

  const memberMap = Object.fromEntries(memberDetails.map((m) => [String(m._id), m]));

  return {
    members:    pageItems.map((item) => ({ ...item, member: memberMap[item.memberId] || null })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ─── getExtraChargeAnalytics ──────────────────────────────────────────────
// Cancelled charges are not "charged": they would otherwise understate the rate.

export const getExtraChargeAnalytics = async () => {
  const notCancelled = { $ne: ["$status", "Cancelled"] };

  const analytics = await ExtraCharge.aggregate([
    {
      $group: {
        _id:          "$label",
        totalCharged: { $sum: { $cond: [notCancelled, "$amount", 0] } },
        totalPaid:    { $sum: { $cond: [{ $eq: ["$status", "Paid"] },   "$amount", 0] } },
        totalUnpaid:  { $sum: { $cond: [{ $eq: ["$status", "Unpaid"] }, "$amount", 0] } },
        countTotal:     { $sum: { $cond: [notCancelled, 1, 0] } },
        countPaid:      { $sum: { $cond: [{ $eq: ["$status", "Paid"] },      1, 0] } },
        countUnpaid:    { $sum: { $cond: [{ $eq: ["$status", "Unpaid"] },    1, 0] } },
        countCancelled: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } },
      },
    },
    { $match: { countTotal: { $gt: 0 } } },
    { $sort: { totalCharged: -1 } },
  ]);

  return analytics.map((item) => ({
    label:          item._id,
    totalCharged:   item.totalCharged,
    totalPaid:      item.totalPaid,
    totalUnpaid:    item.totalUnpaid,
    countTotal:     item.countTotal,
    countPaid:      item.countPaid,
    countUnpaid:    item.countUnpaid,
    countCancelled: item.countCancelled,
    collectionRate: item.totalCharged > 0
      ? Math.round((item.totalPaid / item.totalCharged) * 100)
      : 0,
  }));
};

// ─── getRecentPayments ────────────────────────────────────────────────────

export const getRecentPayments = async (limit = 10) => {
  return Payment
    .find({ status: "completed" })
    .populate("member", "name email membershipNo")
    .sort({ paidAt: -1 })
    .limit(limit)
    .lean();
};

// ─── getPendingPaymentsCount ──────────────────────────────────────────────
// Payments the gateway has confirmed that are waiting for an admin to confirm
// them. ("pending" sessions are still at the gateway: nothing for an admin to do.)

export const getPendingPaymentsCount = async () => {
  return Payment.countDocuments({ status: "verified" });
};

// ─── getAllMembersWithDueStatus ────────────────────────────────────────────

export const getAllMembersWithDueStatus = async () => {
  const [allMembers, monthlyMap, extraDuePerMember] = await Promise.all([
    Member.find({ status: "active" }).select("_id").lean(),
    getMonthlyDueByMemberMap(),
    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", extraDue: { $sum: "$amount" } } },
    ]),
  ]);

  const extraMap = Object.fromEntries(
    extraDuePerMember.map((r) => [String(r._id), r.extraDue]),
  );

  return allMembers.map(({ _id }) => {
    const memberId   = String(_id);
    const monthlyDue = monthlyMap[memberId] || 0;
    const extraDue   = extraMap[memberId]   || 0;
    const totalDue   = monthlyDue + extraDue;

    return {
      memberId,
      monthlyDue,
      extraDue,
      totalDue,
      paymentStatus: totalDue === 0 ? "Paid" : "Due",
    };
  });
};