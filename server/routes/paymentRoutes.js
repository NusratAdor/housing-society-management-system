// routes/paymentRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createPaymentSession,
  paymentCallback,
  getMemberPayments,
  getPendingPayments,
  approvePayment,
  rejectPayment,
} from "../controllers/paymentController.js";

const router = express.Router();

// PROTECTED ROUTES (Member)
router.use(protect);                     // ← ADD THIS
router.post("/create", createPaymentSession);
router.get("/me", getMemberPayments);

// PUBLIC CALLBACK (IPN)
router.post("/callback", paymentCallback);

// ADMIN ROUTES
router.get("/pending", getPendingPayments);
router.put("/approve/:id", approvePayment);
router.put("/reject/:id", rejectPayment);

export default router;