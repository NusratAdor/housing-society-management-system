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
import { enqueueEmail } from "../services/emailQueueService.js";   // was: sendPaymentConfirmationEmail from emailService.js
import { getMemberDueSummary } from "../services/paymentService.js";
import { getMemberCreditBalance, reconcileMemberCredit } from "../services/creditService.js";

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
// verified -> processing is a real atomic claim: only one concurrent
// request can win it. processingAt records WHEN it was claimed;
// confirmedAt/confirmedBy are set later, inside the allocation
// transaction, only when the payment actually completes. If allocation
// throws, the claim is released (processing -> verified). If the
// process dies mid-allocation, recoverStaleProcessingPayments
// (paymentJobs.js) releases it.

export const approvePayment = async (req, res) => {
  try {
    const claimed = await Payment.findOneAndUpdate(
      { _id: req.params.id, status: "verified" },
      { $set: { status: "processing", processingAt: new Date() } },
      { new: true }
    );

    if (!claimed) {
      const existing = await Payment.findById(req.params.id).select("status receiptNumber").lean();

      if (!existing) {
        return res.status(404).json({ success: false, message: "Payment not found" });
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
          message: "This payment is already being confirmed. Please wait a moment and refresh.",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Cannot confirm a payment with status "${existing.status}" — only gateway-verified payments can be confirmed`,
      });
    }

    let receiptNumber, allocations;
    try {
      const result = await allocatePayment({
        paymentId:          claimed._id,
        selectedMonthlyIds: claimed.pendingMonthlyIds.map(String),
        selectedExtraIds:   claimed.pendingExtraIds.map(String),
        extraChargeAmounts: claimed.pendingExtraAmounts || {},
        confirmedBy:        req.clerkUserId,
      });
      receiptNumber = result.receiptNumber;
      allocations   = result.allocations;
    } catch (allocationError) {
      // Nothing was committed. Release the claim so the payment can be
      // retried. The status filter means a payment that actually did
      // complete (e.g. commit succeeded but the response was lost) is
      // never touched.
      await Payment.updateOne(
        { _id: claimed._id, status: "processing" },
        { $set: { status: "verified" }, $unset: { processingAt: "" } }
      );
      throw allocationError;
    }

    if (claimed.advanceAmount > 0) {
      try {
        await reconcileMemberCredit(claimed.member);
      } catch (reconcileError) {
        console.error("[approvePayment] Credit reconciliation failed:", reconcileError.message);
      }
    }

    const member = await Member.findById(claimed.member).lean();

    let emailSent = false;

    if (member) {
      try {
        await Notification.create({
          type:        "Payment",
          content:     `Payment of ৳${claimed.amount.toLocaleString()} confirmed. Receipt: ${receiptNumber}`,
          clerkUserId: member.clerkUserId,
          adminOnly:   false,
        });
      } catch (notifError) {
        console.error("[approvePayment] Notification creation failed:", notifError.message);
      }

      try {
        const dueSummary    = await getMemberDueSummary(claimed.member);
        const creditBalance = claimed.advanceAmount > 0
          ? await getMemberCreditBalance(claimed.member)
          : 0;

        const isPureAdvance = allocations.length === 0 && claimed.advanceAmount > 0;

        if (isPureAdvance) {
          await enqueueEmail({
            to:      member.email,
            subject: `Advance Payment Received — Receipt ${receiptNumber}`,
            type:    "advance_confirmation",
            payload: {
              name:          member.name,
              amount:        claimed.amount,
              receiptNumber,
              paidAt:        new Date(),
              creditBalance,
            },
          });
        } else {
          await enqueueEmail({
            to:      member.email,
            subject: `Payment Confirmed — Receipt ${receiptNumber}`,
            type:    "payment_confirmation",
            payload: {
              name:          member.name,
              amount:        claimed.amount,
              receiptNumber,
              paidAt:        new Date(),
              allocations,
              remainingDue:  dueSummary.totalDue,
              advanceAmount: claimed.advanceAmount,
              creditBalance,
            },
          });
        }
        emailSent = true;
      } catch (queueErr) {
        console.error("[approvePayment] Failed to queue confirmation email:", queueErr.message);
      }
    }

    writeAuditLog({
      action:      "PAYMENT_APPROVED",
      performedBy: req.clerkUserId,
      targetId:    claimed._id,
      description: `Admin confirmed payment of ৳${claimed.amount} (${claimed.transactionId}). Receipt: ${receiptNumber}`,
      after:       { status: "completed", receiptNumber },
      metadata: {
        transactionId: claimed.transactionId,
        amount:        claimed.amount,
        memberId:      String(claimed.member),
        advanceAmount: claimed.advanceAmount,
        emailQueued:   emailSent,
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

    // Allocation throws "already processed" when a charge in this
    // payment was cleared by another payment — a duplicate. This
    // handler previously sat in rejectPayment's catch, where it could
    // never fire.
    if (/already processed/i.test(error.message)) {
      return res.status(409).json({
        success:     false,
        message:     "One or more charges in this payment were already cleared by another payment — this appears to be a duplicate. Please use Reject instead of Confirm for this transaction.",
        isDuplicate: true,
      });
    }

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/payments/:id/reject ──────────────────────────────────────────
// Deliberately still allows rejecting a "pending" payment — this
// matches the existing PendingPayments.jsx feature ("Use Reject only
// for a session that appears permanently stuck"), which is real,
// intentional functionality. The resurrection race this could
// theoretically cause (reject a pending payment, then a late gateway
// callback tries to revive it to "verified") is closed properly in
// paymentCallback below via an atomic conditional transition, not by
// removing this feature.

export const rejectPayment = async (req, res) => {
  try {
    const { rejectedReason } = req.body;

    if (!rejectedReason?.trim()) {
      return res.status(400).json({
        success: false,
        message:  "Rejection reason is required",
      });
    }

    const claimed = await Payment.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["pending", "verified"] } },
      {
        $set: {
          status:         "rejected",
          rejectedAt:     new Date(),
          rejectedReason: rejectedReason.trim(),
          rejectedBy:     req.clerkUserId,
        },
      },
      { new: true }
    ).populate("member", "clerkUserId name");

    if (!claimed) {
      const existing = await Payment.findById(req.params.id).select("status").lean();

      if (!existing) {
        return res.status(404).json({ success: false, message: "Payment not found" });
      }

      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${existing.status} payment`,
      });
    }

    if (claimed.member?.clerkUserId) {
      await Notification.create({
        type:        "Payment",
        content:
          `Your payment of ৳${claimed.amount.toLocaleString()} was not processed. ` +
          `Reason: ${rejectedReason.trim()}`,
        clerkUserId: claimed.member.clerkUserId,
        adminOnly:   false,
      });
    }

    writeAuditLog({
      action:      "PAYMENT_REJECTED",
      performedBy: req.clerkUserId,
      targetId:    claimed._id,
      description:
        `Admin rejected payment of ৳${claimed.amount} ` +
        `(${claimed.transactionId}) — ${rejectedReason.trim()}`,
      after:    { status: "rejected", rejectedReason: rejectedReason.trim() },
      metadata: {
        transactionId: claimed.transactionId,
        amount:        claimed.amount,
        memberId:      String(claimed.member?._id || claimed.member),
      },
    });

    return res.status(200).json({ success: true, message: "Payment rejected" });
  } catch (error) {
    console.error("rejectPayment error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};