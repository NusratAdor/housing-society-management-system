// server/controllers/paymentController.js
//
// Member-facing payment endpoints.
//
// CHANGE (this pass):
//   createPaymentSession
//     - Uses req.member (already loaded by protect) and requires
//       status === "active" — no extra query, and a removed member can
//       never start a payment even if a route forgets requireActiveMember.
//     - If the gateway call throws (timeout/network) the pending Payment is
//       marked failed, so the member is not locked out by the
//       one-active-payment guard.
//     - No longer logs the raw gateway response or response headers.
//     - Sends presentAddress (Member has no "address" field).
//   paymentCallback (public IPN — NOT authenticated)
//     - tran_id must be a string (blocks NoSQL operator injection).
//     - It no longer moves a payment to "failed" based on unauthenticated
//       body fields (status / val_id). Anyone who guessed a tran_id could
//       kill a real payment. The ONLY transition it makes is
//       pending -> verified, and only after the gateway's own validation
//       API confirms transaction ID, amount and currency.
//   getMemberHistory: ?limit is now safely parsed.

import mongoose from "mongoose";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import {
  getMemberPaymentHistory,
  getPaymentAllocationDetails,
} from "../services/paymentService.js";
import axiosLib from "axios";
import { validatePaymentSelection } from "../services/paymentValidationService.js";
import { verifySSLCommerzPayment } from "../services/sslCommerzService.js";

import {
  getMemberFullDashboardData,
  getMemberTransactionHistory,
} from "../services/dashboardService.js";

// ─── GET /api/payments/me/breakdown ───────────────────────────────────────────

export const getDueBreakdown = async (req, res) => {
  try {
    const member = await Member.findOne({
      clerkUserId: req.clerkUserId,
    }).lean();

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    const data = await getMemberFullDashboardData(member._id);

    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("getDueBreakdown error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/payments/me ─────────────────────────────────────────────────────

export const getMemberPayments = async (req, res) => {
  try {
    const member = await Member.findOne({
      clerkUserId: req.clerkUserId,
    }).lean();

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    const payments = await getMemberPaymentHistory(member._id);

    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("getMemberPayments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/payments/me/history ─────────────────────────────────────────────

export const getMemberHistory = async (req, res) => {
  try {
    const member = await Member.findOne({
      clerkUserId: req.clerkUserId,
    }).lean();

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // ?limit=abc used to become NaN. Default 24, allowed range 1-100.
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(
      Math.max(Number.isNaN(requestedLimit) ? 24 : requestedLimit, 1),
      100,
    );

    const history = await getMemberTransactionHistory(member._id, limit);

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("getMemberHistory error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/payments/:id/allocations ───────────────────────────────────────

export const getPaymentAllocations = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment ID" });
    }

    const member = await Member.findOne({
      clerkUserId: req.clerkUserId,
    }).lean();

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    const payment = await Payment.findOne({
      _id: id,
      member: member._id,
    }).lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found or does not belong to you",
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
// Creates an SSLCommerz payment session.
//
// Request body:
//   selectedMonthlyIds  (Array<string>) — MonthlyCharge _ids to pay
//   selectedExtraIds    (Array<string>) — ExtraCharge _ids to pay
//   advanceAmount       (Number)        — optional extra to bank as credit

export const createPaymentSession = async (req, res) => {
  let payment = null;
  let gatewayUrl = null;

  try {
    const {
      selectedMonthlyIds = [],
      selectedExtraIds = [],
      advanceAmount = 0,
    } = req.body;

    if (
      !Array.isArray(selectedMonthlyIds) ||
      !Array.isArray(selectedExtraIds)
    ) {
      return res.status(400).json({
        success: false,
        message: "selectedMonthlyIds and selectedExtraIds must be arrays",
      });
    }

    // protect already loaded req.member; fall back to a query only if absent.
    const member =
      req.member ?? (await Member.findOne({ clerkUserId: req.clerkUserId }));

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    if (member.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is not active and cannot make payments.",
      });
    }

    // ── One-active-payment guard ────────────────────────────────────────
    // A member may only have ONE payment in flight at any time.
    // (The database-level partial unique index is the real guarantee —
    // see the 11000 handling in the catch block.)
    const existingActive = await Payment.findOne({
      member: member._id,
      status: { $in: ["pending", "verified", "processing"] },
    })
      .select("_id status")
      .lean();

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message:
          existingActive.status === "pending"
            ? "You already have a payment in progress. Please complete it, or wait a moment and try again, before starting a new one."
            : "You already have a payment awaiting admin confirmation. Please wait for it to be confirmed before starting a new one.",
      });
    }

    let validationResult;
    try {
      validationResult = await validatePaymentSelection({
        memberId: member._id,
        selectedMonthlyIds,
        selectedExtraIds,
        advanceAmount,
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    const {
      totalAmount,
      selectedMonthly,
      selectedExtra,
      extraChargeAmounts,
      advanceAmount: verifiedAdvanceAmount,
    } = validationResult;

    const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
    const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();
    const BACKEND = process.env.BACKEND_URL?.trim();

    if (!storeId || !storePass || !BACKEND) {
      return res.status(500).json({
        success: false,
        message: "Payment service is not configured. Contact administrator.",
      });
    }

    const tranId = `TX-${Date.now()}-${String(member._id).slice(-6)}`;
    payment = await Payment.create({
      member: member._id,
      amount: totalAmount,
      advanceAmount: verifiedAdvanceAmount,
      transactionId: tranId,
      status: "pending",
      gateway: "sslcommerz",

      pendingMonthlyIds: selectedMonthly.map((c) => c._id),
      pendingExtraIds: selectedExtra.map((c) => c._id),
      pendingExtraAmounts: extraChargeAmounts,
    });

    const isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";
    const sslGatewayUrl = isLive
      ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
      : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

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
      `num_of_item=${Math.max(
        selectedMonthly.length + selectedExtra.length,
        1,
      )}`,
      `cus_name=${encodeURIComponent(member.name)}`,
      `cus_email=${encodeURIComponent(member.email)}`,
      `cus_phone=${encodeURIComponent(member.phone || "")}`,
      `cus_add1=${encodeURIComponent(member.presentAddress || "Dhaka")}`,
      `cus_city=Dhaka`,
      `cus_country=Bangladesh`,
    ].join("&");

    const sslResponse = await axiosLib.post(sslGatewayUrl, fields, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });

    if (
      sslResponse.data.status !== "SUCCESS" ||
      !sslResponse.data.GatewayPageURL
    ) {
      await Payment.findOneAndUpdate(
        { _id: payment._id, status: "pending" },
        { $set: { status: "failed" } },
      );

      console.error("[Payment] SSLCommerz session rejected:", {
        tranId,
        status: sslResponse.data.status,
        reason: sslResponse.data.failedreason,
      });

      return res.status(400).json({
        success: false,
        message:
          sslResponse.data.failedreason ||
          "Payment gateway rejected the request",
      });
    }

    gatewayUrl = sslResponse.data.GatewayPageURL;

    return res.status(200).json({
      success: true,
      url: gatewayUrl,
      paymentId: String(payment._id),
    });
  } catch (error) {
    // Database-level one-active-payment protection.
    if (error?.code === 11000 && error?.keyPattern?.member) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a payment in progress. Please complete it or wait for the current payment to finish.",
      });
    }

    // The member never received a checkout URL, so they cannot pay this
    // session. Mark it failed so it does not lock them out. The status
    // filter means a payment that already moved on is never touched.
    // The document is NOT deleted — failed payments stay as history.
    if (payment && !gatewayUrl) {
      try {
        await Payment.updateOne(
          { _id: payment._id, status: "pending" },
          { $set: { status: "failed" } },
        );
      } catch (cleanupError) {
        console.error(
          "[Payment] Could not mark session failed:",
          cleanupError.message,
        );
      }
    }

    console.error("createPaymentSession error:", error.message, {
      gatewayHttpStatus: error.response?.status,
    });

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── POST /api/payments/callback (SSLCommerz IPN) ────────────────────────────
// PUBLIC route: nothing in the request body is trusted.
// The only state change allowed is pending -> verified, performed with an
// atomic conditional update, after SSLCommerz's validation API confirms
// the transaction ID, amount and currency.
//
// Anything else (failed/cancelled/invalid) is logged and ignored here.
// Abandoned or failed sessions are cleaned up by the stale-pending expiry
// (paymentJobs) or by an admin Reject.

export const paymentCallback = async (req, res) => {
  const { tran_id, status, val_id } = req.body ?? {};

  if (typeof tran_id !== "string" || !tran_id.trim()) {
    console.error("[IPN] Missing or invalid tran_id in callback");
    return res.status(400).send("MISSING_TRAN_ID");
  }

  console.info(
    `[IPN] Received callback for tran_id: ${tran_id}, status: ${status}`,
  );

  try {
    const payment = await Payment.findOne({ transactionId: tran_id });

    if (!payment) {
      console.error(`[IPN] No payment found for tran_id: ${tran_id}`);
      return res.status(200).send("PAYMENT_NOT_FOUND");
    }

       // "failed" is allowed on purpose: the expiry job marks abandoned sessions
    // failed. If the gateway later confirms real money for one, it must still
    // be recorded. "rejected" (an admin decision) is never revived.
    if (!["pending", "failed"].includes(payment.status)) {
      console.info(
        `[IPN] Payment ${tran_id} is "${payment.status}" — ignoring`,
      );
      return res.status(200).send("OK");
    }

    const successStatuses = ["VALID", "VALIDATED"];
    if (!successStatuses.includes(status) || typeof val_id !== "string" || !val_id) {
      console.info(
        `[IPN] Payment ${tran_id}: non-success callback (status: ${status}) — no state change`,
      );
      return res.status(200).send("IGNORED");
    }

    let verificationResult;
    try {
      verificationResult = await verifySSLCommerzPayment({
        valId: val_id,
        tranId: tran_id,
        expectedAmount: payment.amount,
      });
    } catch (verifyError) {
      console.error(
        `[IPN] Validation API error for ${tran_id}:`,
        verifyError.message,
      );
      // 500 so the gateway retries this callback later.
      return res.status(500).send("VALIDATION_API_ERROR");
    }

    if (!verificationResult.isValid) {
      console.warn(
        `[IPN] Payment ${tran_id} failed gateway validation — no state change:`,
        verificationResult.reason || verificationResult.validationData?.status,
      );
      return res.status(200).send("VALIDATION_FAILED");
    }

     let verified;
    try {
      verified = await Payment.findOneAndUpdate(
        { _id: payment._id, status: { $in: ["pending", "failed"] } },
        {
          $set: {
            gatewayValidationId: val_id,
            status: "verified",
            verifiedAt: new Date(),
          },
        },
        { new: true },
      );
    } catch (error) {
      // The member already started another payment, so reviving this one
      // would break the one-active-payment index. Money WAS received.
      if (error?.code === 11000) {
        console.error(
          `[IPN] MANUAL RECONCILIATION NEEDED: gateway confirmed ${tran_id} ` +
            `(val_id ${val_id}) but the member has another active payment.`,
        );
        return res.status(200).send("MANUAL_RECONCILIATION_REQUIRED");
      }
      throw error;
    }

    if (verified) {
      console.info(
        `[IPN] Payment ${tran_id} verified by gateway — awaiting admin confirmation`,
      );
    } else {
      console.info(
        `[IPN] Payment ${tran_id} was no longer "pending" at verification time — skipped`,
      );
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error(
      `[IPN] Unhandled error for tran_id ${tran_id}:`,
      error.message,
    );
    return res.status(500).send("ERROR");
  }
};