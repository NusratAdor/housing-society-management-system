// server/controllers/paymentController.js
//
// Member-facing payment endpoints.
//
// CHANGE (this pass) — two-step confirmation:
//   paymentCallback (the SSLCommerz IPN handler) no longer calls
//   allocatePayment directly. It marks the payment "verified" and stores
//   the confirmed charge selection on the Payment document. Dues are only
//   marked Paid, and the member is only notified/emailed, once an admin
//   explicitly confirms via adminPaymentController.approvePayment.
//   This makes admin confirmation the single, deliberate point where
//   money affects the member's account — not a third-party webhook.

import mongoose     from "mongoose";
import Member       from "../models/Member.js";
import Payment      from "../models/Payment.js";
import {
  getMemberDueBreakdown,
  getMemberPaymentHistory,
  getPaymentAllocationDetails,
} from "../services/paymentService.js";
import axiosLib      from "axios";
import { validatePaymentSelection } from "../services/paymentValidationService.js";
import { verifySSLCommerzPayment }  from "../services/sslCommerzService.js";

import {
  getMemberFullDashboardData,
  getMemberTransactionHistory,
} from "../services/dashboardService.js";

// ─── GET /api/payments/me/breakdown ───────────────────────────────────────────
// Powers the entire PaymentSection component on the member dashboard.
// Returns everything the UI needs in one API call.

export const getDueBreakdown = async (req, res) => {
  try {
    const member = await Member
      .findOne({ clerkUserId: req.clerkUserId })
      .lean();

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data = await getMemberFullDashboardData(member._id);

    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("getDueBreakdown error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/payments/me ─────────────────────────────────────────────────────
// Transaction history for the member — completed, failed, and rejected payments.

export const getMemberPayments = async (req, res) => {
  try {
    const member = await Member
      .findOne({ clerkUserId: req.clerkUserId })
      .lean();

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const payments = await getMemberPaymentHistory(member._id);

    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("getMemberPayments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/payments/me/history ─────────────────────────────────────────────
// Transaction history with per-payment allocation breakdown.

export const getMemberHistory = async (req, res) => {
  try {
    const member = await Member
      .findOne({ clerkUserId: req.clerkUserId })
      .lean();

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const limit   = Math.min(parseInt(req.query.limit || "24", 10), 100);
    const history = await getMemberTransactionHistory(member._id, limit);

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("getMemberHistory error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/payments/:id/allocations ───────────────────────────────────────
// Returns the allocation breakdown for a specific payment.

export const getPaymentAllocations = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const member = await Member
      .findOne({ clerkUserId: req.clerkUserId })
      .lean();

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const payment = await Payment
      .findOne({ _id: id, member: member._id })
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:  "Payment not found or does not belong to you",
      });
    }

    const details = await getPaymentAllocationDetails(id);

    return res.status(200).json({
      success: true,
      payment,
      ...details,
    });
  } catch (error) {
    console.error("getPaymentAllocations error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/payments/create ────────────────────────────────────────────────
// Creates an SSLCommerz payment session for the member's selected charges.
// UNCHANGED from previous pass — still validates the selection, computes the
// verified total, creates a "pending" Payment, opens the gateway session.

export const createPaymentSession = async (req, res) => {

  let payment = null;

  try {
    const { selectedMonthlyIds = [], selectedExtraIds = [], partialAmounts = {} } = req.body;

    if (!Array.isArray(selectedMonthlyIds) || !Array.isArray(selectedExtraIds)) {
      return res.status(400).json({
        success: false,
        message: "selectedMonthlyIds and selectedExtraIds must be arrays",
      });
    }

    const member = await Member
      .findOne({ clerkUserId: req.clerkUserId })
      .lean();

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    let validationResult;
    try {
      validationResult = await validatePaymentSelection({
        memberId: member._id,
        selectedMonthlyIds,
        selectedExtraIds,
        partialAmounts,
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    const { totalAmount, selectedMonthly, selectedExtra, extraChargeAmounts } = validationResult;

    const storeId   = process.env.SSLCOMMERZ_STORE_ID?.trim();
    const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();

    if (!storeId || !storePass) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway is not configured. Contact administrator.",
      });
    }

    const tranId = `TX-${Date.now()}-${String(member._id).slice(-6)}`;

    payment = await Payment.create({
      member:        member._id,
      amount:        totalAmount,
      transactionId: tranId,
      status:        "pending",
      gateway:       "sslcommerz",
    });

    const selectionPayload = Buffer.from(
      JSON.stringify({
        paymentId:          String(payment._id),
        selectedMonthlyIds: selectedMonthly.map(c => String(c._id)),
        selectedExtraIds:   selectedExtra.map(c => String(c._id)),
        extraChargeAmounts,
      })
    ).toString("base64");

    const isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";
    const sslGatewayUrl = isLive
      ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
      : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

    const BACKEND = process.env.BACKEND_URL;

    const fields = [
      `store_id=${storeId}`,
      `store_passwd=${encodeURIComponent(storePass)}`,
      `total_amount=${totalAmount.toFixed(2)}`,
      `currency=BDT`,
      `tran_id=${tranId}`,
      `success_url=${BACKEND}/payment/success`,
      `fail_url=${BACKEND}/payment/failed`,
      `cancel_url=${BACKEND}/payment/cancel`,
      `ipn_url=${BACKEND}/api/payments/callback`,
      `product_name=Society+Maintenance+Dues`,
      `product_category=Membership`,
      `product_profile=general`,
      `shipping_method=NO`,
      `num_of_item=${selectedMonthly.length + selectedExtra.length}`,
      `cus_name=${encodeURIComponent(member.name)}`,
      `cus_email=${encodeURIComponent(member.email)}`,
      `cus_phone=${encodeURIComponent(member.phone || "")}`,
      `cus_add1=${encodeURIComponent(member.address || "Dhaka")}`,
      `cus_city=Dhaka`,
      `cus_country=Bangladesh`,
      `value_a=${req.clerkUserId}`,
      `value_b=${encodeURIComponent(selectionPayload)}`,
    ].join("&");

    const sslResponse = await axiosLib.post(
      sslGatewayUrl,
      fields,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );

    console.log("SSLCommerz raw response:", JSON.stringify(sslResponse.data));

    if (
      sslResponse.data.status !== "SUCCESS" ||
      !sslResponse.data.GatewayPageURL
    ) {
      if (payment) await Payment.findByIdAndDelete(payment._id);
      console.error("SSLCommerz session failed:", sslResponse.data);
      return res.status(400).json({
        success: false,
        message: sslResponse.data.failedreason || "Payment gateway rejected the request",
      });
    }

    return res.status(200).json({
      success:   true,
      url:       sslResponse.data.GatewayPageURL,
      paymentId: String(payment._id),
    });

  } catch (error) {
    if (payment) await Payment.findByIdAndDelete(payment._id);
    console.error("createPaymentSession error:", error.message);
    console.error("SSLCommerz response data:", JSON.stringify(error.response?.data));
    console.error("SSLCommerz response headers:", JSON.stringify(error.response?.headers));
    console.error("SSLCommerz status code:", error.response?.status);
    console.error("Full error:", error.toJSON?.() || error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/payments/callback ─────────────────────────────────────────────
// IPN (Instant Payment Notification) endpoint called by SSLCommerz servers.
//
// CHANGE (this pass): this endpoint's job stops at gateway verification.
// It confirms genuine payment via SSLCommerz's validation API (same
// security-critical check as before — never trust the callback body
// alone), then marks the payment "verified" and stores the confirmed
// selection. It does NOT allocate, does NOT mark charges Paid, and does
// NOT notify the member. That happens only when an admin explicitly
// confirms via PUT /api/payments/:id/confirm (approvePayment).
//
// Response format: plain text "OK" or a status string — SSLCommerz
// expects a text response, not JSON.

export const paymentCallback = async (req, res) => {
  const { tran_id, status, val_id, value_a, value_b } = req.body;

  if (!tran_id) {
    console.error("[IPN] Missing tran_id in callback");
    return res.status(400).send("MISSING_TRAN_ID");
  }

  console.info(`[IPN] Received callback for tran_id: ${tran_id}, status: ${status}`);

  try {
    const payment = await Payment.findOne({ transactionId: tran_id });

    if (!payment) {
      console.error(`[IPN] No payment found for tran_id: ${tran_id}`);
      return res.status(200).send("PAYMENT_NOT_FOUND");
    }

    // ── Idempotency check ─────────────────────────────────────────────────
    // Duplicate IPN callbacks are treated as already-handled at either
    // "verified" or "completed" — both mean this callback already did
    // its job once and there is nothing further to do here.
    if (payment.status === "completed" || payment.status === "verified") {
      console.info(`[IPN] Payment ${tran_id} already ${payment.status} — ignoring duplicate`);
      return res.status(200).send("OK");
    }

    const successStatuses = ["VALID", "VALIDATED"];
    if (!successStatuses.includes(status)) {
      payment.status = "failed";
      await payment.save();
      console.info(`[IPN] Payment ${tran_id} failed with gateway status: ${status}`);
      return res.status(200).send("FAILED");
    }

    // ── CRITICAL: Verify payment with SSLCommerz validation API ──────────
    let verificationResult;
    try {
      verificationResult = await verifySSLCommerzPayment({
        valId:  val_id,
        tranId: tran_id,
      });
    } catch (verifyError) {
      console.error(`[IPN] Validation API error for ${tran_id}:`, verifyError.message);
      return res.status(500).send("VALIDATION_API_ERROR");
    }

    if (!verificationResult.isValid) {
      payment.status = "failed";
      await payment.save();
      console.warn(
        `[IPN] Payment ${tran_id} failed validation:`,
        verificationResult.reason || verificationResult.validationData?.status
      );
      return res.status(200).send("VALIDATION_FAILED");
    }

    // ── Parse the selection payload stored in value_b ─────────────────────
    let selectionData;
    try {
      const decoded = Buffer.from(value_b || "", "base64").toString("utf8");
      selectionData = JSON.parse(decoded || "{}");
    } catch {
      console.error(`[IPN] Could not parse value_b for tran_id ${tran_id}:`, value_b);
      payment.status = "failed";
      await payment.save();
      return res.status(200).send("INVALID_SELECTION_DATA");
    }

    const {
      paymentId:          storedPaymentId,
      selectedMonthlyIds: monthlyIds = [],
      selectedExtraIds:   extraIds   = [],
      extraChargeAmounts  = {},
    } = selectionData;

    if (String(payment._id) !== String(storedPaymentId)) {
      console.error(
        `[IPN] Payment ID mismatch. tran_id: ${tran_id}, ` +
        `DB payment: ${payment._id}, value_b payment: ${storedPaymentId}`
      );
      payment.status = "failed";
      await payment.save();
      return res.status(200).send("PAYMENT_ID_MISMATCH");
    }

    // ── Mark as gateway-verified — do NOT allocate, do NOT notify ─────────
    // This is the deliberate handoff point to the admin. Dues remain
    // "Unpaid" and the member's dashboard is unaffected until an admin
    // calls approvePayment.
    payment.gatewayValidationId = val_id;
    payment.status              = "verified";
    payment.verifiedAt          = new Date();
    payment.pendingMonthlyIds   = monthlyIds;
    payment.pendingExtraIds     = extraIds;
    payment.pendingExtraAmounts = extraChargeAmounts;
    await payment.save();

    console.info(
      `[IPN] Payment ${tran_id} verified by gateway — awaiting admin confirmation`
    );

    return res.status(200).send("OK");
  } catch (error) {
    console.error(`[IPN] Unhandled error for tran_id ${tran_id}:`, error.message);
    return res.status(500).send("ERROR");
  }
};