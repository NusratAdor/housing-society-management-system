// server/routes/paymentRoutes.js

import express     from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  getDueBreakdown,
  getMemberPayments,
  getMemberHistory,
  getPaymentAllocations,
  createPaymentSession,
  paymentCallback,
} from "../controllers/paymentController.js";

import {
  getPendingPayments,
  getVerifiedPayments,
  approvePayment,
  rejectPayment,
} from "../controllers/adminPaymentController.js";

const router = express.Router();

// ── PUBLIC — IPN callback from SSLCommerz ─────────────────────────────────────
router.post("/callback", paymentCallback);

// ── MEMBER ────────────────────────────────────────────────────────────────────
router.get("/me/breakdown",    protect, getDueBreakdown);
router.get("/me/history",      protect, getMemberHistory);
router.get("/me",              protect, getMemberPayments);
router.post("/create",         protect, createPaymentSession);
router.get("/:id/allocations", protect, getPaymentAllocations);

// ── ADMIN ─────────────────────────────────────────────────────────────────────
router.get("/pending",      protect, isAdmin, getPendingPayments);
router.get("/verified",     protect, isAdmin, getVerifiedPayments);
router.put("/:id/confirm",  protect, isAdmin, approvePayment);
router.put("/:id/reject",   protect, isAdmin, rejectPayment);

export default router;