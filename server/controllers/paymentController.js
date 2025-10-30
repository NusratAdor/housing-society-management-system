// controllers/paymentController.js
import Payment from "../models/Payment.js";
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { sendPaymentSuccessEmail } from "../services/emailService.js";
import axios from "axios";

const monthlyFee = 300;

// =============== CREATE PAYMENT SESSION ===============
// controllers/paymentController.js (only the create part changed)

export const createPaymentSession = async (req, res) => {
  try {
    const { amount } = req.body;
    const clerkUserId = req.clerkUserId; // set by protect middleware

    if (!clerkUserId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!amount || amount < 1)
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });

    const member = await Member.findOne({ clerkUserId });
    if (!member)
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });

    const tranId = `TX${Date.now()}`;
    const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
    const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();
    if (!storeId || !storePass) {
      return res
        .status(500)
        .json({ success: false, message: "Gateway not configured" });
    }

    // ---------- SSLCOMMERZ REQUEST ----------
    const postData = {
      store_id: storeId,
      store_passwd: storePass,
      total_amount: Number(amount).toFixed(2),
      currency: "BDT",
      tran_id: tranId,
      success_url: `${process.env.BACKEND_URL}/payment/success`,
      fail_url: `${process.env.BACKEND_URL}/payment/failed`,
      cancel_url: `${process.env.BACKEND_URL}/payment/cancel`,
      ipn_url: `${process.env.BACKEND_URL}/api/payments/callback`,
      
      shipping_method: "NO",
      num_of_item: "1",
      product_name: "Membership Dues",
      product_category: "Membership",
      product_profile: "general",
      cus_name: member.name,
      cus_email: member.email,
      cus_add1: member.address || "",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      cus_phone: member.phone || "",
      value_a: clerkUserId,
    };

    const response = await axios.post(
      "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
      new URLSearchParams(postData).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );

    const data = response.data;
    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      return res.status(400).json({
        success: false,
        message: data.failedreason || "Gateway error",
      });
    }

    // ---------- SAVE PENDING (NO month/year) ----------
    await Payment.create({
      member: member._id,
      amount: Number(amount),
      transactionId: tranId,
      status: "Pending",
      method: "Gateway",
    });

    return res.json({ success: true, url: data.GatewayPageURL });
  } catch (error) {
    console.error("Payment init error:", error.response?.data || error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to start payment" });
  }
};

// =============== CALLBACK – AUTO ASSIGN MONTHS ===============
export const paymentCallback = async (req, res) => {
  try {
    const { tran_id, status, val_id, card_type, bank_tran_id } = req.body;
    if (!tran_id) return res.status(400).send("Missing tran_id");

    const payment = await Payment.findOne({ transactionId: tran_id }).populate(
      "member"
    );
    if (!payment) return res.status(404).send("Payment not found");

    if (["VALID", "VALIDATED", "SUCCESS"].includes(status)) {
      // ---- Mark gateway payment as Paid ----
      payment.status = "Paid";
      payment.paidAt = new Date();
      payment.method = card_type?.split("-")[0] || "Gateway";
      payment.sslValId = val_id;
      payment.bankTranId = bank_tran_id;
      await payment.save();

      const member = payment.member;
      const monthlyFee = 300;
      let remaining = payment.amount;

      // ---- 1. Pay off oldest *unpaid* months (if any) ----
      const unpaid = await Payment.find({
        member: member._id,
        status: { $ne: "Paid" },
        month: { $exists: true },
      }).sort({ year: 1, month: 1 });

      for (const p of unpaid) {
        if (remaining >= monthlyFee) {
          p.status = "Paid";
          p.paidAt = new Date();
          await p.save();
          remaining -= monthlyFee;
        } else if (remaining > 0) {
          p.amount = remaining;
          p.status = "Partial";
          await p.save();
          remaining = 0;
          break;
        } else break;
      }

      // ---- 2. If still money left → create *future* paid months ----
      if (remaining >= monthlyFee) {
        let cursor = new Date(); // start from next month
        while (remaining >= monthlyFee) {
          cursor.setMonth(cursor.getMonth() + 1);
          await Payment.create({
            member: member._id,
            amount: monthlyFee,
            month: cursor.getMonth() + 1,
            year: cursor.getFullYear(),
            status: "Paid",
            method: "Gateway",
            paidAt: new Date(),
            transactionId: tran_id, // link to original gateway tx
          });
          remaining -= monthlyFee;
        }
      }

      // ---- 3. Update member dueAmount & status ----
      member.dueAmount = Math.max(0, (member.dueAmount || 0) - payment.amount);
      member.paymentStatus = member.dueAmount === 0 ? "Paid" : "Due";
      await member.save();

      // ---- 4. Notify + email ----
      await Notification.create({
        type: "Payment",
        content: `Payment of ৳${payment.amount} successful. Due reduced.`,
        clerkUserId: member.clerkUserId,
        adminOnly: false,
      });

      await sendPaymentSuccessEmail({
        to: member.email,
        name: member.name,
        amount: payment.amount,
        month: "Multiple",
        year: new Date().getFullYear(),
      });

      return res.send("OK");
    } else {
      payment.status = "Failed";
      payment.failedReason = status || "Failed";
      await payment.save();
      return res.send("FAILED");
    }
  } catch (error) {
    console.error("IPN error:", error);
    return res.status(500).send("ERROR");
  }
};

// =============== MEMBER HISTORY ===============
export const getMemberPayments = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    if (!clerkUserId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const member = await Member.findOne({ clerkUserId });
    if (!member)
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });

    const payments = await Payment.find({ member: member._id }).sort({
      year: -1,
      month: -1,
    });
    return res.json({ success: true, payments });
  } catch (error) {
    console.error("getMemberPayments error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =============== ADMIN FUNCTIONS (same as before) ===============
export const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "Pending" }).populate(
      "member"
    );
    return res.json({ success: true, payments });
  } catch (error) {
    console.error("getPendingPayments error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id).populate("member");
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    payment.status = "Paid";
    payment.paidAt = new Date();
    await payment.save();

    const member = await Member.findById(payment.member._id);
    member.dueAmount = Math.max(0, (member.dueAmount || 0) - payment.amount);
    member.paymentStatus =
      member.dueAmount === 0
        ? "Paid"
        : member.dueAmount > 0
        ? "Due"
        : "Pending";
    await member.save();

    await Notification.create({
      type: "Payment",
      content: `Your payment for ${payment.month}/${payment.year} has been approved.`,
      clerkUserId: member.clerkUserId,
      adminOnly: false,
    });

    try {
      await sendPaymentSuccessEmail({
        to: member.email,
        name: member.name,
        month: payment.month,
        year: payment.year,
        amount: payment.amount,
      });
    } catch (mailErr) {
      console.error("Approve payment mail failed:", mailErr);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("approvePayment error:", error);
    return res.status(500).json({ success: false, message: "Approval failed" });
  }
};

export const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedReason } = req.body;
    if (!rejectedReason?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Reason is required" });

    const payment = await Payment.findById(id).populate("member");
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    payment.status = "Rejected";
    payment.rejectedAt = new Date();
    payment.rejectedReason = rejectedReason;
    await payment.save();

    await Notification.create({
      type: "Payment",
      content: `Your payment for ${payment.month}/${payment.year} was rejected: ${rejectedReason}`,
      clerkUserId: payment.member.clerkUserId,
      adminOnly: false,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("rejectPayment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Rejection failed" });
  }
};
