// server/controllers/settingsController.js
//
// HTTP layer only — reads req, calls feeService, sends res.
// No business logic here. All fee logic lives in feeService.js.

import AuditLog from "../models/AuditLog.js";
import {
  getCurrentFee,
  getFeeHistory,
  createFeeRecord,
  getFeeForMonth,
} from "../services/feeService.js";

// ─── GET /api/settings/monthly-fee ───────────────────────────────────────────
// Public — member dashboard and admin both read this.
// Returns the fee currently in effect.

export const getMonthlyFee = async (req, res) => {
  try {
    const fee = await getCurrentFee();
    return res.status(200).json({ success: true, monthlyFee: fee });
  } catch (error) {
    console.error("getMonthlyFee error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/settings/fee-history ───────────────────────────────────────────
// Admin only — full log of fee changes for the audit view.

export const getFeeHistoryHandler = async (req, res) => {
  try {
    const history = await getFeeHistory();
    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("getFeeHistory error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/settings/monthly-fee ───────────────────────────────────────────
// Admin only — creates a new FeeHistory record.
//
// Request body:
//   amount        (Number, required)  — new fee amount in BDT
//   reason        (String, optional)  — why the fee is changing
//   effectFrom    (String, optional)  — "next" (default) or "current"
//                                       "next"    → effective from 1st of next month
//                                       "current" → effective from 1st of this month

export const updateMonthlyFee = async (req, res) => {
  try {
    const { amount, reason, effectFrom } = req.body;

    // Validation
    if (!amount || isNaN(amount) || Number(amount) < 1) {
      return res.status(400).json({
        success: false,
        message:  "Amount must be a positive number",
      });
    }

    if (effectFrom && !["next", "current"].includes(effectFrom)) {
      return res.status(400).json({
        success: false,
        message:  "effectFrom must be 'next' or 'current'",
      });
    }

    const previousFee = await getCurrentFee();

    const record = await createFeeRecord({
      amount:         Number(amount),
      reason:         reason?.trim() || "",
      createdBy:      req.clerkUserId,
      effectFromNext: effectFrom !== "current", // default: next month
    });

    // Audit log — record what changed, from what to what, and when
    await AuditLog.create({
      action:      "FEE_CHANGED",
      performedBy: req.clerkUserId,
      targetId:    record._id,
      description: `Monthly fee changed from ৳${previousFee} to ৳${amount}`,
      before:      { amount: previousFee },
      after:       { amount: Number(amount), effectiveFrom: record.effectiveFrom },
      metadata:    { reason: reason?.trim() || "", effectFrom: effectFrom || "next" },
    });

    return res.status(201).json({
      success:       true,
      monthlyFee:    record.amount,
      effectiveFrom: record.effectiveFrom,
      message: effectFrom === "current"
        ? `Fee updated to ৳${amount} — effective this month`
        : `Fee updated to ৳${amount} — effective from next month`,
    });
  } catch (error) {
    console.error("updateMonthlyFee error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/settings/fee-for-month ─────────────────────────────────────────
// Admin/dev utility — returns the fee that applies to a specific month/year.
// Useful for verifying that the fee history is correctly structured.
// Query params: month (1-12), year (YYYY)

export const getFeeForMonthHandler = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year  = parseInt(req.query.year,  10);

    if (!month || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "month must be between 1 and 12",
      });
    }

    if (!year || year < 2020) {
      return res.status(400).json({
        success: false,
        message: "year must be 2020 or later",
      });
    }

    const fee = await getFeeForMonth(month, year);

    return res.status(200).json({
      success: true,
      month,
      year,
      fee,
    });
  } catch (error) {
    console.error("getFeeForMonth error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};