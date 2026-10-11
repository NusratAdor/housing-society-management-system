// server/routes/paymentRoutes.js

import express     from "express";
import rateLimit   from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
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

// Starting a gateway session is the expensive, abusable action.
const createPaymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment attempts. Please wait a few minutes.",
  },
});

// ── PUBLIC — IPN callback from SSLCommerz ─────────────────────────────────────
router.post("/callback", paymentCallback);

// ── MEMBER — active members only ─────────────────────────────────────────────
router.get("/me/breakdown",    protect, requireActiveMember, getDueBreakdown);
router.get("/me/history",      protect, requireActiveMember, getMemberHistory);
router.get("/me",              protect, requireActiveMember, getMemberPayments);
router.post("/create",         protect, requireActiveMember, createPaymentLimiter, createPaymentSession);
router.get("/:id/allocations", protect, requireActiveMember, validateObjectId(), getPaymentAllocations);

// ── ADMIN — deliberately unrestricted by requireActiveMember: an admin
// must still be able to confirm/reject a payment that was made before
// a member was removed, to keep the financial record accurate ────────
router.get("/pending",      protect, isAdmin, getPendingPayments);
router.get("/verified",     protect, isAdmin, getVerifiedPayments);
router.put("/:id/confirm",  protect, isAdmin, validateObjectId(), approvePayment);
router.put("/:id/reject",   protect, isAdmin, validateObjectId(), rejectPayment);

export default router;