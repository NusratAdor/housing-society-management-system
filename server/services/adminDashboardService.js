// server/services/adminDashboardService.js

import mongoose      from "mongoose";
import Member        from "../models/Member.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge   from "../models/ExtraCharge.js";
import Payment       from "../models/Payment.js";

// ─── getCollectionMetrics ─────────────────────────────────────────────────────

export const getCollectionMetrics = async () => {
  const now              = new Date();
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Run every independent query in parallel
  const [
    allTimeAgg,
    thisMonthAgg,
    todayAgg,
    outstandingMonthlyAgg,
    outstandingExtraAgg,
    totalMembersCount,
    // Members-with-dues calculation done with .distinct() below —
    // two lightweight queries instead of one heavy $lookup pipeline
    unpaidMonthlyMembers,
    unpaidExtraMembers,
    allMemberIds,   
  ] = await Promise.all([

    Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Payment.aggregate([
      { $match: { status: "completed", paidAt: { $gte: startOfThisMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Payment.aggregate([
      { $match: { status: "completed", paidAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    MonthlyCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Member.countDocuments({}),

    // Returns array of ObjectIds — one per member with an unpaid monthly charge
    MonthlyCharge.distinct("member", { status: "Unpaid" }),

    // Returns array of ObjectIds — one per member with an unpaid extra charge
    ExtraCharge.distinct("member", { status: "Unpaid" }),

    Member.distinct("_id"),
  ]);

  // Union the two sets to get every member who owes anything
  const membersWithDuesSet = new Set([
    ...unpaidMonthlyMembers.map(String),
    ...unpaidExtraMembers.map(String),
  ]);

  const allMemberIdStrings = new Set(allMemberIds.map(String));

  const membersWithDuesCount = [...membersWithDuesSet].filter(
    id => allMemberIdStrings.has(id)
  ).length;
  
  const totalOutstanding =
    (outstandingMonthlyAgg[0]?.total || 0) +
    (outstandingExtraAgg[0]?.total   || 0);

return {
    totalCollection:     allTimeAgg[0]?.total     || 0,
    thisMonthCollection: thisMonthAgg[0]?.total    || 0,
    todayCollection:     todayAgg[0]?.total        || 0,
    totalOutstanding,
    outstandingMonthly:  outstandingMonthlyAgg[0]?.total || 0,
    outstandingExtra:    outstandingExtraAgg[0]?.total   || 0,
    membersWithDues:     membersWithDuesCount,
    membersPaid:         totalMembersCount - membersWithDuesCount,
    totalMembers:        totalMembersCount,
  };
};

// ─── getMonthlyCollectionTrend ────────────────────────────────────────────────

export const getMonthlyCollectionTrend = async (months = 12) => {
  const now    = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const trend = await Payment.aggregate([
    { $match: { status: "completed", paidAt: { $gte: cutoff } } },
    {
      $group: {
        _id:       { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
        collected: { $sum: "$amount" },
        payments:  { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  // Fill every month in the range — even months with zero payments
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const targetDate  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const targetYear  = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;

    const found = trend.find(
      t => t._id.year === targetYear && t._id.month === targetMonth
    );

    result.push({
      year:      targetYear,
      month:     targetMonth,
      collected: found?.collected || 0,
      payments:  found?.payments  || 0,
    });
  }

  return result;
};

// ─── getOutstandingMembersList ────────────────────────────────────────────────

export const getOutstandingMembersList = async ({ page = 1, limit = 20 } = {}) => {
  const [monthlyDuePerMember, extraDuePerMember] = await Promise.all([
    MonthlyCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", monthlyDue: { $sum: "$amount" } } },
    ]),
    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", extraDue: { $sum: "$amount" } } },
    ]),
  ]);

  const dueMap = {};
  for (const r of monthlyDuePerMember) {
    const id   = String(r._id);
    dueMap[id] = { ...dueMap[id], monthlyDue: r.monthlyDue };
  }
  for (const r of extraDuePerMember) {
    const id   = String(r._id);
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

  const total      = sorted.length;
  const pageItems  = sorted.slice((page - 1) * limit, (page - 1) * limit + limit);

  const memberIds     = pageItems.map(item => new mongoose.Types.ObjectId(item.memberId));
  const memberDetails = await Member
    .find({ _id: { $in: memberIds } })
    .select("name email membershipNo plotNo phone")
    .lean();

  const memberMap = Object.fromEntries(memberDetails.map(m => [String(m._id), m]));

  return {
    members:    pageItems.map(item => ({ ...item, member: memberMap[item.memberId] || null })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ─── getExtraChargeAnalytics ──────────────────────────────────────────────────

export const getExtraChargeAnalytics = async () => {
  const analytics = await ExtraCharge.aggregate([
    {
      $group: {
        _id:          "$label",
        totalCharged: { $sum: "$amount" },
        totalPaid:    { $sum: { $cond: [{ $eq: ["$status", "Paid"] },      "$amount", 0] } },
        totalUnpaid:  { $sum: { $cond: [{ $eq: ["$status", "Unpaid"] },    "$amount", 0] } },
        countTotal:     { $sum: 1 },
        countPaid:      { $sum: { $cond: [{ $eq: ["$status", "Paid"] },      1, 0] } },
        countUnpaid:    { $sum: { $cond: [{ $eq: ["$status", "Unpaid"] },    1, 0] } },
        countCancelled: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } },
      },
    },
    { $sort: { totalCharged: -1 } },
  ]);

  return analytics.map(item => ({
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

// ─── getRecentPayments ────────────────────────────────────────────────────────

export const getRecentPayments = async (limit = 10) => {
  return Payment
    .find({ status: "completed" })
    .populate("member", "name email membershipNo")
    .sort({ paidAt: -1 })
    .limit(limit)
    .lean();
};

// ─── getPendingPaymentsCount ──────────────────────────────────────────────────

export const getPendingPaymentsCount = async () => {
  return Payment.countDocuments({ status: "pending", gateway: "sslcommerz" });
};



export const getAllMembersWithDueStatus = async () => {
  const [allMembers, monthlyDuePerMember, extraDuePerMember] = await Promise.all([
    Member.find({}).select("_id").lean(),

    MonthlyCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", monthlyDue: { $sum: "$amount" } } },
    ]),

    ExtraCharge.aggregate([
      { $match: { status: "Unpaid" } },
      { $group: { _id: "$member", extraDue: { $sum: "$amount" } } },
    ]),
  ]);

  const monthlyMap = Object.fromEntries(
    monthlyDuePerMember.map(r => [String(r._id), r.monthlyDue])
  );
  const extraMap = Object.fromEntries(
    extraDuePerMember.map(r => [String(r._id), r.extraDue])
  );

  // Start from EVERY member, not just members that appear in the
  // unpaid-charges aggregations — this is the key difference from
  // getOutstandingMembersList, which starts from the dueMap and therefore
  // can only ever contain members who owe something.
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