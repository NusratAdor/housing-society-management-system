// server/controllers/adminDashboardController.js
//
// Admin dashboard HTTP endpoints.
// Each endpoint maps to one or more adminDashboardService functions.
// Thin controller — no business logic, just HTTP parsing and responses.

import {
  getCollectionMetrics,
  getMonthlyCollectionTrend,
  getOutstandingMembersList,
  getExtraChargeAnalytics,
  getRecentPayments,
  getPendingPaymentsCount,
  getAllMembersWithDueStatus,
} from "../services/adminDashboardService.js";



// ─── GET /api/admin/dashboard/metrics ─────────────────────────────────────────
// Summary cards: total collection, outstanding, member counts.
// This is the first thing that renders on the admin dashboard.

export const getDashboardMetrics = async (req, res) => {
  try {
    const [metrics, pendingCount] = await Promise.all([
      getCollectionMetrics(),
      getPendingPaymentsCount(),
    ]);

    return res.status(200).json({
      success: true,
      ...metrics,
      pendingPaymentsCount: pendingCount,
    });
  } catch (error) {
    console.error("getDashboardMetrics error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/dashboard/trend ───────────────────────────────────────────
// Monthly collection trend for the chart.
// Query param: months (default 12, max 24)

export const getCollectionTrend = async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months || "12", 10), 24);
    const trend  = await getMonthlyCollectionTrend(months);

    return res.status(200).json({ success: true, trend });
  } catch (error) {
    console.error("getCollectionTrend error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/dashboard/outstanding ─────────────────────────────────────
// Paginated list of members with outstanding dues.
// Query params: page, limit

export const getOutstandingMembers = async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || "1",  10);
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);

    const result = await getOutstandingMembersList({ page, limit });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("getOutstandingMembers error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/dashboard/charge-analytics ────────────────────────────────
// Extra charge analytics — collection rates by charge type.

export const getChargeAnalytics = async (req, res) => {
  try {
    const analytics = await getExtraChargeAnalytics();
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("getChargeAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/dashboard/recent-payments ────────────────────────────────
// Recent completed payments for the activity feed.
// Query param: limit (default 10, max 50)

export const getRecentPaymentsHandler = async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const payments = await getRecentPayments(limit);

    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("getRecentPayments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/admin/dashboard — combined single call ─────────────────────────
// Returns ALL dashboard data in one call.
// The admin Dashboard.jsx component calls this once on mount.
// Subsequent tab changes use the individual endpoints above.

export const getFullAdminDashboard = async (req, res) => {
  try {
    const [metrics, trend, outstanding, chargeAnalytics, recentPayments, pendingCount] =
      await Promise.all([
        getCollectionMetrics(),
        getMonthlyCollectionTrend(12),
        getOutstandingMembersList({ page: 1, limit: 5 }),
        getExtraChargeAnalytics(),
        getRecentPayments(10),
        getPendingPaymentsCount(),
      ]);

    return res.status(200).json({
      success: true,
      metrics: { ...metrics, pendingPaymentsCount: pendingCount },
      trend,
      outstanding,
      chargeAnalytics,
      recentPayments,
    });
  } catch (error) {
    console.error("getFullAdminDashboard error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};







// ─── GET /api/admin/dashboard/member-due-status ───────────────────────────
// Returns due status for every member, including fully paid ones.
// Used by the Manage Members table — distinct from /outstanding, which
// intentionally excludes paid members for the dashboard "top dues" widget.

export const getMemberDueStatus = async (req, res) => {
  try {
    const rows = await getAllMembersWithDueStatus();
    return res.status(200).json({ success: true, members: rows });
  } catch (error) {
    console.error("getMemberDueStatus error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};