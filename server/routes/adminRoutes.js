// server/routes/adminRoutes.js
// CHANGE: added member seat routes

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

import { triggerMonthlyDue } from "../controllers/adminPaymentController.js";

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

// NEW — member seat management
import memberSeatRoutes from "./memberSeatRoutes.js";

const router = express.Router();

router.use(protect, isAdmin);

// ── Member seats ──────────────────────────────────────────────────────────────
router.use("/seats", memberSeatRoutes);

// ── Member management ─────────────────────────────────────────────────────────
router.get(    "/members",                       getAllMembers);
router.put(    "/members/:id",                   updateMemberProfile);
router.delete( "/members/:id",                   deleteMember);
router.put(    "/members/:id/approve",           approveAdmin);
router.put(    "/members/:id/reject-admin-request", rejectAdminRequest);

// ── Payment management ────────────────────────────────────────────────────────
router.post("/trigger-monthly-due", triggerMonthlyDue);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/dashboard",                    getFullAdminDashboard);
router.get("/dashboard/metrics",            getDashboardMetrics);
router.get("/dashboard/trend",              getCollectionTrend);
router.get("/dashboard/outstanding",        getOutstandingMembers);
router.get("/dashboard/charge-analytics",   getChargeAnalytics);
router.get("/dashboard/recent-payments",    getRecentPaymentsHandler);
router.get("/dashboard/member-due-status",  getMemberDueStatus);

router.get("/audit-log", getAuditLogHandler);

export default router;