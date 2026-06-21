// server/routes/paymentRoutes.js — complete file through Step 9

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
  rejectPayment,
} from "../controllers/adminPaymentController.js";

const router = express.Router();

// ── PUBLIC — IPN callback from SSLCommerz ─────────────────────────────────────
// Must be before protect middleware — SSLCommerz has no auth token
router.post("/callback", paymentCallback);

// ── MEMBER ────────────────────────────────────────────────────────────────────
// Literal paths before parameterised /:id paths — critical Express rule
router.get("/me/breakdown",    protect, getDueBreakdown);
router.get("/me/history",      protect, getMemberHistory);
router.get("/me",              protect, getMemberPayments);
router.post("/create",         protect, createPaymentSession);
router.get("/:id/allocations", protect, getPaymentAllocations);

router.get("/pending",      protect, isAdmin, getPendingPayments);
router.put("/:id/reject",   protect, isAdmin, rejectPayment);

export default router;