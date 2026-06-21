// server/routes/adminRoutes.js — complete updated file

import express     from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";

import {
  getAllMembers,
  updateMemberProfile,
  deleteMember,
  approveAdmin,
  rejectAdminRequest,
} from "../controllers/adminController.js";

import {
  triggerMonthlyDue,
} from "../controllers/adminPaymentController.js";

import {
  getDashboardMetrics,
  getCollectionTrend,
  getOutstandingMembers,
  getChargeAnalytics,
  getRecentPaymentsHandler,
  getFullAdminDashboard,
  getMemberDueStatus,
} from "../controllers/adminDashboardController.js";

import { getAuditLogHandler } from "../controllers/auditController.js";




const router = express.Router();

// All routes require authentication AND admin role
router.use(protect, isAdmin);

// ── Member management ─────────────────────────────────────────────────────────
router.get("/members",              getAllMembers);
router.put("/members/:id",          updateMemberProfile);
router.delete("/members/:id",       deleteMember);
router.put("/members/:id/approve",  approveAdmin);
router.put("/members/:id/reject-admin-request", rejectAdminRequest);

// ── Payment management ────────────────────────────────────────────────────────
// Dev/test only — blocked in production by controller guard
router.post("/trigger-monthly-due", triggerMonthlyDue);

// ── Dashboard metrics — specific paths before parameterised ───────────────────
// Combined endpoint — admin Dashboard.jsx calls this once on mount
router.get("/dashboard",                 getFullAdminDashboard);
// Individual endpoints for tab-level data refresh
router.get("/dashboard/metrics",         getDashboardMetrics);
router.get("/dashboard/trend",           getCollectionTrend);
router.get("/dashboard/outstanding",     getOutstandingMembers);
router.get("/dashboard/charge-analytics", getChargeAnalytics);
router.get("/dashboard/recent-payments", getRecentPaymentsHandler);
router.get("/dashboard/member-due-status", getMemberDueStatus);

router.get("/audit-log", getAuditLogHandler);


export default router;