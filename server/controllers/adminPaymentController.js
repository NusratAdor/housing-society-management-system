// server/controllers/adminPaymentController.js
//
// approvePayment is the ONLY place a payment ever actually clears dues,
// generates a receipt, and notifies/emails the member.
//
// CHANGE (this pass): allocatePayment now handles the charges portion of
// EVERY payment uniformly — including a pure-advance payment, where
// pendingMonthlyIds/pendingExtraIds are simply empty arrays (allocatePayment
// already handles empty selections correctly, creating zero
// PaymentAllocation records and just marking the payment completed). If
// payment.advanceAmount > 0, that amount becomes available credit purely
// by virtue of sitting on the now-"completed" Payment document — no
// separate deposit-recording step needed. The admin is shown, and the
// member is emailed, the resulting credit balance when relevant.

import Payment         from "../models/Payment.js";
import Member          from "../models/Member.js";
import Notification    from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { createMonthlyChargesForMonth } from "../services/chargeService.js";
import { allocatePayment } from "../services/allocationService.js";
import { sendPaymentConfirmationEmail } from "../services/emailService.js";
import { getMemberDueSummary } from "../services/paymentService.js";
import { getMemberCreditBalance } from "../services/creditService.js";

export const triggerMonthlyDue = async (req, res) => {
  if (process.env.DISABLE_MANUAL_TRIGGERS === "true") {
    return res.status(403).json({
      success: false,
      message: "Manual trigger is not available in production",
    });
  }
  try {
    const now   = new Date();
    const month = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
    const year  = req.query.year  ? parseInt(req.query.year,  10) : now.getFullYear();

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Invalid month" });
    }

    const result = await createMonthlyChargesForMonth({
      month,
      year,
      performedBy: req.clerkUserId,
    });

    return res.status(201).json({
      success: true,
      message: result.created > 0
        ? `Created ${result.created} charge(s) of ৳${result.fee} for ${month}/${year}`
        : `No new charges — all ${result.skipped} member(s) already have charges`,
      result,
    });
  } catch (error) {
    console.error("triggerMonthlyDue error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment
      .find({ status: "pending" })
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
    const payments = await Payment
      .find({ status: "verified" })
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

export const approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== "verified") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm a payment with status "${payment.status}" — only gateway-verified payments can be confirmed`,
      });
    }

    const { receiptNumber, allocations } = await allocatePayment({
      paymentId:          payment._id,
      selectedMonthlyIds: payment.pendingMonthlyIds.map(String),
      selectedExtraIds:   payment.pendingExtraIds.map(String),
      extraChargeAmounts: payment.pendingExtraAmounts || {},
    });

    payment.confirmedBy = req.clerkUserId;
    payment.confirmedAt = new Date();
    await payment.save();

    const member = await Member.findById(payment.member).lean();

    let emailSent = false;

    if (member) {
      try {
        await Notification.create({
          type:        "Payment",
          content:     `Payment of ৳${payment.amount.toLocaleString()} confirmed. Receipt: ${receiptNumber}`,
          clerkUserId: member.clerkUserId,
          adminOnly:   false,
        });
      } catch (notifError) {
        console.error("[approvePayment] Notification creation failed:", notifError.message);
      }

      try {
        const dueSummary   = await getMemberDueSummary(payment.member);
        const creditBalance = payment.advanceAmount > 0
          ? await getMemberCreditBalance(payment.member)
          : 0;

        await sendPaymentConfirmationEmail({
          to:            member.email,
          name:          member.name,
          amount:        payment.amount,
          receiptNumber,
          paidAt:        payment.paidAt || new Date(),
          allocations,
          remainingDue:  dueSummary.totalDue,
          advanceAmount: payment.advanceAmount,
          creditBalance,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("[approvePayment] Confirmation email failed:", emailErr.message);
      }
    }

    writeAuditLog({
      action:      "PAYMENT_APPROVED",
      performedBy: req.clerkUserId,
      targetId:    payment._id,
      description: `Admin confirmed payment of ৳${payment.amount} (${payment.transactionId}). Receipt: ${receiptNumber}`,
      after:       { status: "completed", receiptNumber },
      metadata: {
        transactionId: payment.transactionId,
        amount:        payment.amount,
        memberId:      String(payment.member),
        advanceAmount: payment.advanceAmount,
        emailSent,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Payment confirmed. Receipt ${receiptNumber}`,
      receiptNumber,
      emailSent,
    });
  } catch (error) {
    console.error("approvePayment error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/payments/:id/reject ──────────────────────────────────────────

export const rejectPayment = async (req, res) => {
  try {
    const { rejectedReason } = req.body;

    if (!rejectedReason?.trim()) {
      return res.status(400).json({
        success: false,
        message:  "Rejection reason is required",
      });
    }

    const payment = await Payment
      .findById(req.params.id)
      .populate("member", "clerkUserId name");

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (!["pending", "verified"].includes(payment.status)) {
      return res.status(400).json({
        success: false,
        message:  `Cannot reject a ${payment.status} payment`,
      });
    }

    const beforeStatus = payment.status;

    payment.status         = "rejected";
    payment.rejectedAt     = new Date();
    payment.rejectedReason = rejectedReason.trim();
    payment.rejectedBy     = req.clerkUserId;
    await payment.save();

    if (payment.member?.clerkUserId) {
      await Notification.create({
        type:        "Payment",
        content:
          `Your payment of ৳${payment.amount.toLocaleString()} was not processed. ` +
          `Reason: ${rejectedReason.trim()}`,
        clerkUserId: payment.member.clerkUserId,
        adminOnly:   false,
      });
    }

    writeAuditLog({
      action:      "PAYMENT_REJECTED",
      performedBy: req.clerkUserId,
      targetId:    payment._id,
      description:
        `Admin rejected payment of ৳${payment.amount} ` +
        `(${payment.transactionId}) — ${rejectedReason.trim()}`,
      before:   { status: beforeStatus },
      after:    { status: "rejected", rejectedReason: rejectedReason.trim() },
      metadata: {
        transactionId: payment.transactionId,
        amount:        payment.amount,
        memberId:      String(payment.member?._id || payment.member),
      },
    });

    return res.status(200).json({ success: true, message: "Payment rejected" });
} catch (error) {
    console.error("approvePayment error:", error.message);

    // allocatePayment throws this specific message when a charge in this
    // payment's selection was already cleared by another payment — the
    // exact situation created by duplicate/overlapping payment sessions.
    // Surface this plainly instead of a generic 500 so the admin knows
    // exactly what happened and what to do about it (reject this one).
    const isDuplicateChargeConflict = /already processed/i.test(error.message);

    if (isDuplicateChargeConflict) {
      return res.status(409).json({
        success:     false,
        message:     "One or more charges in this payment were already cleared by another payment — this appears to be a duplicate. Please use Reject instead of Confirm for this transaction.",
        isDuplicate: true,
      });
    }

    return res.status(500).json({ success: false, message: "Server error" });
  }
};