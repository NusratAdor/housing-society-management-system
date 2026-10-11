// server/controllers/adminPaymentController.js
//
// approvePayment is the ONLY place a payment ever actually clears dues,
// generates a receipt, and notifies/emails the member.
//
// CHANGE (this pass):
//   1. triggerMonthlyDue validates month/year as real integers. The service
//      (chargeService) now also refuses future months.
//   2. rejectPayment is now transactional: status change + PAYMENT_REJECTED
//      audit (required) commit together. The member notification is
//      best-effort AFTER commit, so a notification failure can no longer
//      turn a successful rejection into a 500.

import Payment from "../models/Payment.js";
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { createMonthlyChargesForMonth } from "../services/chargeService.js";
import { allocatePayment } from "../services/allocationService.js";
import { enqueueEmail } from "../services/emailQueueService.js";

import { buildPaymentStatement } from "../services/paymentStatementService.js";
import { notifyPaymentConfirmed } from "../services/paymentNotificationService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { getDhakaDateParts } from "../utils/dateTime.js";
import {
  reconcileMemberCredit,
  getMemberCreditBalance,
} from "../services/creditService.js";


export const triggerMonthlyDue = async (req, res) => {
  if (process.env.DISABLE_MANUAL_TRIGGERS === "true") {
    return res.status(403).json({
      success: false,
      message: "Manual trigger is not available in production",
    });
  }
  try {
    const { year: dhakaYear, month: dhakaMonth } = getDhakaDateParts();

    const month = req.query.month ? Number(req.query.month) : dhakaMonth;
    const year = req.query.year ? Number(req.query.year) : dhakaYear;

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Invalid month" });
    }

    if (!Number.isInteger(year) || year < 2000 || year > dhakaYear) {
      return res.status(400).json({ success: false, message: "Invalid year" });
    }

    const result = await createMonthlyChargesForMonth({
      month,
      year,
      performedBy: req.clerkUserId,
    });

    return res.status(201).json({
      success: true,
      message:
        result.created > 0
          ? `Created ${result.created} charge(s) of ৳${result.fee} for ${month}/${year}`
          : `No new charges — all ${result.skipped} member(s) already have charges`,
      result,
    });
  } catch (error) {
    console.error("triggerMonthlyDue error:", error.message);
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "pending" })
      .populate("member", "name email membershipNo phone")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("getPendingPayments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getVerifiedPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "verified" })
      .populate("member", "name email membershipNo phone")
      .sort({ verifiedAt: -1 })
      .lean();
    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("getVerifiedPayments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/payments/:id/confirm ─────────────────────────────────────────
// verified -> processing is a real atomic claim: only one concurrent
// request can win it. If allocation throws, the claim is released
// (processing -> verified). If the process dies mid-allocation,
// recoverStaleProcessingPayments (paymentJobs.js) releases it.

export const approvePayment = async (req, res) => {
  try {
    const claimed = await Payment.findOneAndUpdate(
      { _id: req.params.id, status: "verified" },
      { $set: { status: "processing", processingAt: new Date() } },
      { new: true },
    );

    if (!claimed) {
      const existing = await Payment.findById(req.params.id)
        .select("status receiptNumber")
        .lean();

      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      if (existing.status === "completed") {
        return res.status(200).json({
          success: true,
          message: `Payment already confirmed. Receipt ${existing.receiptNumber}`,
          receiptNumber: existing.receiptNumber,
          emailSent: false,
          alreadyProcessed: true,
        });
      }

      if (existing.status === "processing") {
        return res.status(409).json({
          success: false,
          message:
            "This payment is already being confirmed. Please wait a moment and refresh.",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Cannot confirm a payment with status "${existing.status}" — only gateway-verified payments can be confirmed`,
      });
    }

    // Credit held BEFORE this payment's money exists (a "processing" payment
    // is not counted as credit yet). Captured here so the statement never has
    // to reconstruct history from today's balance.
    
       let receiptNumber, allocations, paidAt, creditBefore;
    try {
      const result = await allocatePayment({
        paymentId: claimed._id,
        selectedMonthlyIds: claimed.pendingMonthlyIds.map(String),
        selectedExtraIds: claimed.pendingExtraIds.map(String),
        extraChargeAmounts: claimed.pendingExtraAmounts || {},
        confirmedBy: req.clerkUserId,
      });
      receiptNumber = result.receiptNumber;
      allocations = result.allocations;
      paidAt = result.paidAt;
      creditBefore = result.creditBefore;
    } catch (allocationError) {
      await Payment.updateOne(
        { _id: claimed._id, status: "processing" },
        { $set: { status: "verified" }, $unset: { processingAt: "" } },
      );
      throw allocationError;
    }
    // ── Credit reconciliation (payment is already completed) ────────────
    // notify:false → no separate "credit applied" message. The one
    // confirmation message/email below states what the credit paid for.
    let creditClearedIds = [];
    if (claimed.advanceAmount > 0) {
      try {
        creditClearedIds = await reconcileMemberCredit(claimed.member, {
          notify: false,
        });
      } catch (reconcileError) {
        console.error(
          `[approvePayment] Credit reconciliation failed for member ` +
            `${claimed.member}. Payment ${claimed._id} remains completed; ` +
            `reconciliation can be retried safely:`,
          reconcileError.message,
        );
      }
    }

    // ── ONE statement → ONE notification + ONE email ────────────────────
    const member = await Member.findById(claimed.member)
      .select("clerkUserId name email")
      .lean();

    let emailSent = false;

    if (member) {
      let statement = null;
      try {
        statement = await buildPaymentStatement({
          payment: claimed,
          receiptNumber,
          paidAt,
          creditBefore,
          allocations,
          creditClearedIds,
        });
      } catch (statementError) {
        console.error(
          `[approvePayment] Could not build statement for ${claimed._id}:`,
          statementError.message,
        );
      }

      if (member.clerkUserId) {
        await notifyPaymentConfirmed({
          clerkUserId: member.clerkUserId,
          paymentId: claimed._id,
          statement: statement ?? {
            amount: claimed.amount,
            receiptNumber,
          },
        });
      }

      if (statement && member.email) {
        try {
          await enqueueEmail({
            to: member.email,
            subject: `Payment Confirmed — Receipt ${receiptNumber}`,
            type: "payment_confirmation",
            payload: { name: member.name, statement },
          });
          emailSent = true;
        } catch (queueErr) {
          console.error(
            "[approvePayment] Failed to queue confirmation email:",
            queueErr.message,
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Payment confirmed. Receipt ${receiptNumber}`,
      receiptNumber,
      emailSent,
    });
  } catch (error) {
    console.error("approvePayment error:", error.message);

    if (/already processed/i.test(error.message)) {
      return res.status(409).json({
        success: false,
        message:
          "One or more charges in this payment were already cleared by another payment — this appears to be a duplicate. Please use Reject instead of Confirm for this transaction.",
        isDuplicate: true,
      });
    }

    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// ─── PUT /api/payments/:id/reject ──────────────────────────────────────────
// Still allows rejecting a "pending" payment (PendingPayments.jsx: "Use
// Reject only for a session that appears permanently stuck").
//
// NOTE for the office: rejecting a "verified" payment means the gateway
// already took the member's money. Rejecting does NOT refund it — the
// refund must be handled through SSLCommerz separately.

export const rejectPayment = async (req, res) => {
  try {
    const reason =
      typeof req.body?.rejectedReason === "string"
        ? req.body.rejectedReason.trim()
        : "";

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    if (reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be 500 characters or less",
      });
    }

    // Status change + required audit commit together or not at all.
    const previous = await runInTransactionWithRetry(async (session) => {
      // new:false returns the document as it was BEFORE the update,
      // which is exactly the "before" state the audit needs.
      const before = await Payment.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ["pending", "verified"] } },
        {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
            rejectedReason: reason,
            rejectedBy: req.clerkUserId,
          },
        },
        { new: false, session },
      );

      if (!before) return null;

      await writeAuditLog({
        action: "PAYMENT_REJECTED",
        performedBy: req.clerkUserId,
        targetId: before._id,
        description:
          `Admin rejected payment of ৳${before.amount} ` +
          `(${before.transactionId}) — ${reason}`,
        before: { status: before.status },
        after: { status: "rejected", rejectedReason: reason },
        metadata: {
          transactionId: before.transactionId,
          amount: before.amount,
          memberId: String(before.member),
        },
        session,
        required: true,
      });

      return before;
    });

    if (!previous) {
      const existing = await Payment.findById(req.params.id)
        .select("status")
        .lean();

      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${existing.status} payment`,
      });
    }

    // Best-effort, AFTER commit: the rejection already happened.
    try {
      const member = await Member.findById(previous.member)
        .select("clerkUserId")
        .lean();

      if (member?.clerkUserId) {
        await Notification.create({
          type: "Payment",
          content:
            `Your payment of ৳${previous.amount.toLocaleString()} was not processed. ` +
            `Reason: ${reason}`,
          clerkUserId: member.clerkUserId,
          adminOnly: false,
        });
      }
    } catch (notifError) {
      console.error(
        "[rejectPayment] Notification creation failed:",
        notifError.message,
      );
    }

    return res.status(200).json({ success: true, message: "Payment rejected" });
  } catch (error) {
    console.error("rejectPayment error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
