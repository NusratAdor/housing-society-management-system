// server/controllers/adminPaymentController.js
//
// CHANGE (this pass): added getVerifiedPayments and approvePayment.
// approvePayment is now the ONLY place a payment ever actually clears
// dues, generates a receipt, and notifies/emails the member — it runs
// allocatePayment() using the exact charge selection the gateway
// confirmed at IPN time (stored on the Payment document).
// rejectPayment now also accepts "verified" payments, not just "pending".
// triggerMonthlyDue and getPendingPayments unchanged.

import Payment         from "../models/Payment.js";
import Member          from "../models/Member.js";
import Notification    from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { createMonthlyChargesForMonth } from "../services/chargeService.js";
import { allocatePayment } from "../services/allocationService.js";
import { sendPaymentConfirmationEmail } from "../services/emailService.js";

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

// ─── GET /api/payments/pending ─────────────────────────────────────────────
// Payment sessions still mid-transaction with the gateway — nothing for
// an admin to actively do here yet, this is a visibility/stuck-session
// queue. The actionable queue is getVerifiedPayments below.

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

// ─── GET /api/payments/verified ────────────────────────────────────────────
// Payments the gateway has confirmed money was received for, but which an
// admin has not yet reviewed. This is the primary actionable queue —
// confirming here is what actually clears dues and notifies the member.

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
// Admin confirms a gateway-verified payment.
//
// This is the ONLY code path that:
//   - marks MonthlyCharge/ExtraCharge records Paid (via allocatePayment,
//     using the exact selection the gateway confirmed at IPN time)
//   - generates the receipt number
//   - sends the in-app notification
//   - sends the confirmation email
//
// If allocatePayment throws (e.g. a charge was somehow already paid by
// another route), the error propagates and the payment stays "verified" —
// nothing partial or inconsistent is left behind, matching the atomicity
// guarantee documented in allocationService.js.

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

    const { receiptNumber } = await allocatePayment({
      paymentId:          payment._id,
      selectedMonthlyIds: payment.pendingMonthlyIds.map(String),
      selectedExtraIds:   payment.pendingExtraIds.map(String),
      extraChargeAmounts: payment.pendingExtraAmounts || {},
    });

    payment.confirmedBy = req.clerkUserId;
    payment.confirmedAt = new Date();
    await payment.save();

    const member = await Member.findById(payment.member).lean();

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

      sendPaymentConfirmationEmail({
        to:            member.email,
        name:          member.name,
        amount:        payment.amount,
        receiptNumber,
        paidAt:        payment.paidAt || new Date(),
        monthlyIds:    payment.pendingMonthlyIds.map(String),
        extraIds:      payment.pendingExtraIds.map(String),
      }).catch(emailErr => {
        console.error("[approvePayment] Confirmation email failed:", emailErr.message);
      });
    }

    writeAuditLog({
      action:      "PAYMENT_CONFIRMED",
      performedBy: req.clerkUserId,
      targetId:    payment._id,
      description: `Admin confirmed payment of ৳${payment.amount} (${payment.transactionId}). Receipt: ${receiptNumber}`,
      after:       { status: "completed", receiptNumber },
      metadata: {
        transactionId: payment.transactionId,
        amount:        payment.amount,
        memberId:      String(payment.member),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Payment confirmed. Receipt ${receiptNumber}`,
      receiptNumber,
    });
  } catch (error) {
    console.error("approvePayment error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/payments/:id/reject ──────────────────────────────────────────
// Can now reject either a "pending" (stuck gateway session) or a
// "verified" (gateway confirmed, but admin determined it's disputed,
// duplicate, or erroneous) payment. A "completed" payment can never be
// rejected here — that would require a separate refund/reversal flow,
// which is intentionally out of scope for this endpoint.

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
    console.error("rejectPayment error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};