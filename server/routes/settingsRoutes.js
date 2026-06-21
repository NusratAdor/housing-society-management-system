// server/routes/settingsRoutes.js
import axiosLib from "axios";
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  getMonthlyFee,
  getFeeHistoryHandler,
  updateMonthlyFee,
  getFeeForMonthHandler,
} from "../controllers/settingsController.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// Member dashboard reads this to display the current monthly fee
router.get("/monthly-fee", getMonthlyFee);

// ── Admin only ────────────────────────────────────────────────────────────────
router.get("/fee-history",     protect, isAdmin, getFeeHistoryHandler);
router.put("/monthly-fee",     protect, isAdmin, updateMonthlyFee);

// Dev/testing utility — verify fee lookup correctness
// Example: GET /api/settings/fee-for-month?month=3&year=2025
router.get("/fee-for-month",   protect, isAdmin, getFeeForMonthHandler);

// TEMPORARY — delete after testing
router.get("/test-ssl", protect, isAdmin, async (req, res) => {
  try {
    const response = await axiosLib.get(
      "https://sandbox.sslcommerz.com",
      { timeout: 10000 }
    );
    res.json({ success: true, status: response.status });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
      code:    error.code,
      status:  error.response?.status,
    });
  }
});

export default router;