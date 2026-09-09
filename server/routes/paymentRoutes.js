// server/routes/paymentRoutes.js

import express     from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
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

// ── MEMBER — active members only ─────────────────────────────────────────────
router.get("/me/breakdown",    protect, requireActiveMember, getDueBreakdown);
router.get("/me/history",      protect, requireActiveMember, getMemberHistory);
router.get("/me",              protect, requireActiveMember, getMemberPayments);
router.post("/create",         protect, requireActiveMember, createPaymentSession);
router.get("/:id/allocations", protect, requireActiveMember, getPaymentAllocations);

// ── ADMIN — deliberately unrestricted by requireActiveMember: an admin
// must still be able to confirm/reject a payment that was made before
// a member was removed, to keep the financial record accurate ────────
router.get("/pending",      protect, isAdmin, getPendingPayments);
router.get("/verified",     protect, isAdmin, getVerifiedPayments);
router.put("/:id/confirm",  protect, isAdmin, approvePayment);
router.put("/:id/reject",   protect, isAdmin, rejectPayment);

export default router;