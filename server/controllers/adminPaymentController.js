// server/controllers/adminPaymentController.js
// rejectPayment updated to include audit log.
// triggerMonthlyDue and getPendingPayments unchanged.

import Payment         from "../models/Payment.js";
import Member          from "../models/Member.js";
import Notification    from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { createMonthlyChargesForMonth } from "../services/chargeService.js";

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

    if (payment.status !== "pending") {
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

    // Notify the member
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

    // Audit log — fire-and-forget
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