// server/controllers/paymentController.js
//
// Member-facing payment endpoints.
// Step 5 adds: getDueBreakdown, getPaymentHistory
// Step 6 adds: createPaymentSession (below in this same file)
// Step 7 adds: paymentCallback, approvePayment, rejectPayment
//
// This file grows across steps — all payment controller code lives here.

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
import { allocatePayment }          from "../services/allocationService.js";
import { verifySSLCommerzPayment }  from "../services/sslCommerzService.js";
import { sendPaymentConfirmationEmail } from "../services/emailService.js";
import Notification from "../models/Notification.js";

import {
  getMemberFullDashboardData,
  getMemberTransactionHistory,
} from "../services/dashboardService.js";



// ─── GET /api/payments/me/breakdown ───────────────────────────────────────────
// Powers the entire PaymentSection component on the member dashboard.
// Returns everything the UI needs in one API call.

// ─── GET /api/payments/me/breakdown ───────────────────────────────────────────
// Replaces the Step 5 version with the enriched version.
// Single endpoint — returns everything PaymentSection needs.
// No other API calls needed from the frontend payment section.

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
// Used by the expandable transaction table in the dashboard.
// Separate from /me/breakdown because it is heavier and opened on demand.

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
// Used for receipt display — member can see what their payment covered.

export const getPaymentAllocations = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    // Verify this payment belongs to the requesting member
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
//
// Request body:
//   selectedMonthlyIds  (Array<string>) — MonthlyCharge _ids to pay
//   selectedExtraIds    (Array<string>) — ExtraCharge _ids to pay
//
// Flow:
//   1. Validate selection (FIFO, ownership, unpaid status)
//   2. Compute verified total from DB records
//   3. Create pending Payment record
//   4. Open SSLCommerz session with charge IDs in value_b
//   5. Return gateway URL to frontend
//
// Why we store charge IDs in SSLCommerz value_b:
//   The IPN callback needs to know which charges to allocate the payment to.
//   value_b is SSLCommerz's custom data field that gets echoed back in the
//   callback. We serialize the charge IDs there so the callback can retrieve
//   them without any server-side session or database lookup between steps.

export const createPaymentSession = async (req, res) => {
  
  // TEMPORARY debug logs
  console.log("ENV CHECK:", {
    storeId:     process.env.SSLCOMMERZ_STORE_ID,
    storePass:   process.env.SSLCOMMERZ_STORE_PASS,
    backendUrl:  process.env.BACKEND_URL,
    frontendUrl: process.env.FRONTEND_URL,
  });

  let payment = null; // declare here so catch block can access it

  try {
    const { selectedMonthlyIds = [], selectedExtraIds = [] } = req.body;

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
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    const { totalAmount, selectedMonthly, selectedExtra } = validationResult;

    const storeId   = process.env.SSLCOMMERZ_STORE_ID?.trim();
    const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();

    if (!storeId || !storePass) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway is not configured. Contact administrator.",
      });
    }

    const tranId = `TX-${Date.now()}-${String(member._id).slice(-6)}`;

    // declared at top so catch block can clean it up
    payment = await Payment.create({
      member:        member._id,
      amount:        totalAmount,
      transactionId: tranId,
      status:        "pending",
      gateway:       "sslcommerz",
    });

    const selectionPayload = JSON.stringify({
      paymentId:          String(payment._id),
      selectedMonthlyIds: selectedMonthly.map(c => String(c._id)),
      selectedExtraIds:   selectedExtra.map(c => String(c._id)),
    });

    const isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";
const sslGatewayUrl = isLive
  ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
  : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

// WITH this — using URLSearchParams:

const params = new URLSearchParams();
params.append("store_id",        storeId);
params.append("store_passwd",    storePass);
params.append("total_amount",    totalAmount.toFixed(2));
params.append("currency",        "BDT");
params.append("tran_id",         tranId);
params.append("success_url",     `${process.env.BACKEND_URL}/payment/success`);
params.append("fail_url",        `${process.env.BACKEND_URL}/payment/failed`);
params.append("cancel_url",      `${process.env.BACKEND_URL}/payment/cancel`);
params.append("ipn_url",         `${process.env.BACKEND_URL}/api/payments/callback`);
params.append("product_name",    "Society Maintenance Dues");
params.append("product_category","Membership");
params.append("product_profile", "general");
params.append("shipping_method", "NO");
params.append("num_of_item",     String(selectedMonthly.length + selectedExtra.length));
params.append("cus_name",        member.name);
params.append("cus_email",       member.email);
params.append("cus_phone",       member.phone || "");
params.append("cus_add1",        member.address || "Dhaka");
params.append("cus_city",        "Dhaka");
params.append("cus_country",     "Bangladesh");
params.append("value_a",         req.clerkUserId);
params.append("value_b",         selectionPayload);

// Log what we are actually sending
console.log("=== SSLCOMMERZ URLSearchParams ===");
console.log(params.toString());
console.log("==================================");

const sslResponse = await axiosLib.post(
  sslGatewayUrl,
  params,                    // pass URLSearchParams directly — Axios handles it natively
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
// This is called by SSLCommerz, NOT by the member's browser.
//
// The member's browser goes to /payment/success → frontend.
// SSLCommerz separately POSTs to this URL with the payment result.
// These are two independent flows that may arrive in any order.
//
// Security requirements:
//   1. Verify the payment with SSLCommerz's validation API (not just status field)
//   2. Cross-reference transaction ID to prevent replay attacks
//   3. Be idempotent — SSLCommerz may send the callback more than once
//   4. Respond quickly — SSLCommerz has a short timeout for IPN callbacks
//
// Response format: plain text "OK" or "FAILED" — SSLCommerz expects this.

export const paymentCallback = async (req, res) => {
  const { tran_id, status, val_id, value_a, value_b } = req.body;

  // ── Basic presence check ──────────────────────────────────────────────
  if (!tran_id) {
    console.error("[IPN] Missing tran_id in callback");
    return res.status(400).send("MISSING_TRAN_ID");
  }

  console.info(`[IPN] Received callback for tran_id: ${tran_id}, status: ${status}`);

  try {
    // ── Find the pending payment record ───────────────────────────────────
    const payment = await Payment.findOne({ transactionId: tran_id });

    if (!payment) {
      console.error(`[IPN] No payment found for tran_id: ${tran_id}`);
      // Return 200 to prevent SSLCommerz from retrying indefinitely
      return res.status(200).send("PAYMENT_NOT_FOUND");
    }

    // ── Idempotency check ─────────────────────────────────────────────────
    if (payment.status === "completed") {
      // Already processed — duplicate callback. Acknowledge silently.
      console.info(`[IPN] Payment ${tran_id} already completed — ignoring duplicate`);
      return res.status(200).send("OK");
    }

    // ── Handle non-successful gateway status without API call ─────────────
    const successStatuses = ["VALID", "VALIDATED"];
    if (!successStatuses.includes(status)) {
      payment.status = "failed";
      await payment.save();
      console.info(`[IPN] Payment ${tran_id} failed with gateway status: ${status}`);
      return res.status(200).send("FAILED");
    }

    // ── CRITICAL: Verify payment with SSLCommerz validation API ──────────
    // Never trust the callback body alone — always verify with the API.
    let verificationResult;
    try {
      verificationResult = await verifySSLCommerzPayment({
        valId:  val_id,
        tranId: tran_id,
      });
    } catch (verifyError) {
      // Validation API unreachable — do not mark as failed yet.
      // SSLCommerz will retry the IPN callback. Log and return 500
      // so SSLCommerz knows to retry.
      console.error(`[IPN] Validation API error for ${tran_id}:`, verifyError.message);
      return res.status(500).send("VALIDATION_API_ERROR");
    }

    if (!verificationResult.isValid) {
      // Payment verification failed — mark as failed
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
      selectionData = JSON.parse(value_b || "{}");
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
    } = selectionData;

    // Cross-check: the payment ID in value_b must match the payment we found
    if (String(payment._id) !== String(storedPaymentId)) {
      console.error(
        `[IPN] Payment ID mismatch. tran_id: ${tran_id}, ` +
        `DB payment: ${payment._id}, value_b payment: ${storedPaymentId}`
      );
      payment.status = "failed";
      await payment.save();
      return res.status(200).send("PAYMENT_ID_MISMATCH");
    }

    // Store SSLCommerz validation data on the payment for audit
    payment.gatewayValidationId = val_id;
    await payment.save();

    // ── Atomically allocate the payment ───────────────────────────────────
    const { receiptNumber } = await allocatePayment({
      paymentId:         payment._id,
      selectedMonthlyIds: monthlyIds,
      selectedExtraIds:   extraIds,
    });

    console.info(
      `[IPN] Payment ${tran_id} allocated successfully. Receipt: ${receiptNumber}`
    );

    // ── Post-allocation: notifications and email ──────────────────────────
    // These run AFTER the transaction commits.
    // Failures here do NOT roll back the payment — money is already allocated.
    // Each step is wrapped in its own try/catch so one failure does not
    // prevent the others.

    // Find the member for notification and email
    const member = await Member.findById(payment.member).lean();

    if (member) {
      // In-app notification
      try {
        await Notification.create({
          type:        "Payment",
          content:     `Payment of ৳${payment.amount.toLocaleString()} confirmed. Receipt: ${receiptNumber}`,
          clerkUserId: member.clerkUserId,
          adminOnly:   false,
        });
      } catch (notifError) {
        console.error("[IPN] Notification creation failed:", notifError.message);
      }

      // Confirmation email — non-blocking fire-and-forget
      // Email failure must never fail the payment confirmation
      sendPaymentConfirmationEmail({
        to:            member.email,
        name:          member.name,
        amount:        payment.amount,
        receiptNumber,
        paidAt:        payment.paidAt || new Date(),
        monthlyIds,
        extraIds,
      }).catch(emailErr => {
        console.error("[IPN] Confirmation email failed:", emailErr.message);
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error(`[IPN] Unhandled error for tran_id ${tran_id}:`, error.message);
    // Return 500 so SSLCommerz retries the callback
    return res.status(500).send("ERROR");
  }
};