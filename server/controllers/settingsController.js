// server/controllers/settingsController.js
//
// HTTP layer only — reads req, calls feeService, sends res.
//
// CHANGE (this pass):
//   - A fee change is now a transaction: FeeHistory record + required
//     FEE_CHANGED audit commit together (it was never audited).
//   - Members get one broadcast notification after commit (idempotent).
//   - Setting the very first fee no longer fails: getCurrentFee() throws when
//     no fee exists yet.
//   - Amount is validated as a finite number with a sanity ceiling.

import {
  getCurrentFee,
  getFeeHistory,
  createFeeRecord,
  getFeeForMonth,
} from "../services/feeService.js";
import { writeAuditLog } from "../services/auditService.js";
import { notifyFeeChanged } from "../services/paymentNotificationService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";

const MAX_MONTHLY_FEE = 1_000_000; // typo guard, not a business rule

// ─── GET /api/settings/monthly-fee ───────────────────────────────────────────

export const getMonthlyFee = async (req, res) => {
  try {
    const fee = await getCurrentFee();
    return res.status(200).json({ success: true, monthlyFee: fee });
  } catch (error) {
    console.error("getMonthlyFee error:", error.message);
    return res.status(503).json({
      success: false,
      message: "Fee not yet configured. Please contact the administrator.",
    });
  }
};

// ─── GET /api/settings/fee-history ───────────────────────────────────────────

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
// Body: amount (required), reason (optional), effectFrom ("next" | "current")

export const updateMonthlyFee = async (req, res) => {
  try {
    const { amount, reason, effectFrom } = req.body;
    const newAmount = Number(amount);

    if (!Number.isFinite(newAmount) || newAmount < 1 || newAmount > MAX_MONTHLY_FEE) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    if (effectFrom && !["next", "current"].includes(effectFrom)) {
      return res.status(400).json({
        success: false,
        message: "effectFrom must be 'next' or 'current'",
      });
    }

    // First-ever fee: nothing to compare against.
    let previousFee = null;
    try {
      previousFee = await getCurrentFee();
    } catch {
      previousFee = null;
    }

    const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";

    let record;
    try {
      record = await runInTransactionWithRetry(async (session) => {
        const created = await createFeeRecord({
          amount: newAmount,
          reason: cleanReason,
          createdBy: req.clerkUserId,
          effectFromNext: effectFrom !== "current",
          session,
        });

        await writeAuditLog({
          action: "FEE_CHANGED",
          performedBy: req.clerkUserId,
          targetId: created._id,
          description:
            `Monthly fee ${previousFee === null ? "set" : `changed from ৳${previousFee}`} ` +
            `to ৳${created.amount}, effective ${created.effectiveFrom.toISOString().slice(0, 10)}.`,
          before: previousFee === null ? undefined : { amount: previousFee },
          after: { amount: created.amount, effectiveFrom: created.effectiveFrom },
          metadata: { reason: cleanReason || null },
          session,
          required: true,
        });

        return created;
      });
    } catch (createError) {
      const isDuplicateKey       = createError.code === 11000;
      const isAppendOnlyConflict = createError.message?.includes("already recorded");

      if (isDuplicateKey || isAppendOnlyConflict) {
        return res.status(409).json({
          success: false,
          message: isAppendOnlyConflict
            ? createError.message
            : "A fee change is already recorded for this effective date.",
        });
      }
      throw createError;
    }

    // After commit, best-effort. Only when the amount actually changed.
    if (previousFee !== null && previousFee !== record.amount) {
      await notifyFeeChanged({
        recordId: record._id,
        previousFee,
        newFee: record.amount,
        effectiveFrom: record.effectiveFrom,
      });
    }

    return res.status(201).json({
      success:       true,
      monthlyFee:    record.amount,
      effectiveFrom: record.effectiveFrom,
      message: effectFrom === "current"
        ? `Fee updated to ৳${record.amount} — effective this month`
        : `Fee updated to ৳${record.amount} — effective from next month`,
    });
  } catch (error) {
    console.error("updateMonthlyFee error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/settings/fee-for-month ─────────────────────────────────────────

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

    return res.status(200).json({ success: true, month, year, fee });
  } catch (error) {
    console.error("getFeeForMonth error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};