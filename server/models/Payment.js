// server/models/Payment.js
//
// One record per actual money transfer from member to society.
// Represents raw money received — it records THAT money was received
// and HOW MUCH, but not WHAT it was for.
// What the money covers is recorded in PaymentAllocation.
//
// This separation is the foundation of double-entry accounting:
//   Payment     = money received (credit side)
//   Allocation  = charge cleared (debit side reconciled)
//
// CHANGE (this pass) — two-step confirmation:
//   Gateway confirmation ("verified") and dues being marked Paid
//   ("completed") are now two distinct events, not one. This is a
//   deliberate reconciliation control: an admin must explicitly confirm
//   a gateway-verified payment before it affects a member's dues or
//   triggers a notification/email. See paymentController.paymentCallback
//   (sets "verified") and adminPaymentController.approvePayment (sets
//   "completed" and performs the actual allocation).
//
//   pendingMonthlyIds / pendingExtraIds / pendingExtraAmounts capture the
//   exact charge selection confirmed by the gateway at IPN time, so
//   approvePayment can later replay it into allocatePayment() without
//   any re-derivation or ambiguity about what was actually paid for.

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    // Total amount received from the gateway — verified by SSLCommerz
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Payment amount must be at least 1 BDT"],
    },

    // Unique transaction ID — from SSLCommerz for gateway payments,
    // manually generated for admin-approved payments
    transactionId: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
    },

    // "pending"   → initiated, awaiting gateway confirmation
    // "verified"  → gateway (IPN + validation API) confirmed money was
    //               received — dues NOT yet marked Paid, member NOT yet
    //               notified. Awaiting admin confirmation.
    // "completed" → admin confirmed. Dues marked Paid, receipt issued,
    //               member notified — via approvePayment.
    // "failed"    → gateway reported failure
    // "rejected"  → admin manually rejected (from "pending" or "verified")
    status: {
      type:    String,
      enum:    ["pending", "verified", "completed", "failed", "rejected"],
      default: "pending",
    },

    // Payment method used
    gateway: {
      type:    String,
      enum:    ["sslcommerz", "manual"],
      default: "sslcommerz",
    },

    // SSLCommerz validation ID — used to verify payment authenticity
    // by calling SSLCommerz's validation API in the IPN callback.
    // Without verifying this, any attacker who knows your callback URL
    // can fake a successful payment.
    gatewayValidationId: {
      type: String,
    },

    // Human-readable receipt number generated once payment is CONFIRMED
    // by an admin (status → "completed").
    // Format: RCP-YYYY-NNNNNN (e.g. RCP-2025-000123)
    // Unique, sparse — null until confirmed.
    receiptNumber: {
      type:   String,
      unique: true,
      sparse: true,
    },

    paidAt: {
      type: Date,
    },

    // Set when the gateway confirms the payment (status → "verified")
    verifiedAt: {
      type: Date,
    },

    // The charge selection confirmed by the gateway at IPN time.
    // Stored here (not re-derived) so admin confirmation allocates
    // exactly what was actually paid for.
    pendingMonthlyIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref:  "MonthlyCharge",
    }],
    pendingExtraIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref:  "ExtraCharge",
    }],
    pendingExtraAmounts: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Clerk userId of the admin who confirmed this payment (status → "completed")
    confirmedBy: {
      type: String,
    },
    confirmedAt: {
      type: Date,
    },

    // For rejected payments
    rejectedAt: {
      type: Date,
    },

    rejectedReason: {
      type:    String,
      default: "",
      trim:    true,
    },

    // Clerk userId of admin who rejected (if applicable)
    rejectedBy: {
      type: String,
    },

    isCreditDeposit: {
      type:    Boolean,
      default: false,
    },
    
  },
  {
    timestamps: true,
  }
);

// Common query: all payments for a member by status
paymentSchema.index({ member: 1, status: 1 });

// Admin queues — pending gateway sessions, and verified-awaiting-confirmation
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, verifiedAt: -1 });

export default mongoose.model("Payment", paymentSchema);