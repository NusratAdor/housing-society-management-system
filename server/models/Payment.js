// server/models/Payment.js
//
// One record per actual money transfer from member to society.
//
// CHANGE (this pass): replaced isCreditDeposit (boolean, whole-payment)
// with advanceAmount (Number, default 0) — the portion of THIS payment's
// total that is banked as credit rather than tied to a selected charge.
// This lets a single payment be partly "clear my current dues" and
// partly "add extra for future months" at the same time, instead of
// forcing an all-or-nothing choice. See creditService.js for how the
// credit balance is derived from this field.

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    // Total amount received from the gateway — verified by SSLCommerz.
    // Always equals (sum of selected charges) + advanceAmount.
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Payment amount must be at least 1 BDT"],
    },

    // The portion of `amount` above that is banked as credit for future
    // dues, rather than clearing a specific selected charge. 0 for an
    // ordinary payment with no advance component — identical behavior to
    // before this field existed.
    advanceAmount: {
      type:    Number,
      default: 0,
      min:     [0, "Advance amount cannot be negative"],
    },

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
    // "completed" → admin confirmed. Charges portion allocated, advance
    //               portion becomes available credit, member notified.
    // "failed"    → gateway reported failure
    // "rejected"  → admin manually rejected
    status: {
      type:    String,
      enum:    ["pending", "verified", "completed", "failed", "rejected"],
      default: "pending",
    },

    gateway: {
      type:    String,
      enum:    ["sslcommerz", "manual"],
      default: "sslcommerz",
    },

    gatewayValidationId: {
      type: String,
    },

    receiptNumber: {
      type:   String,
      unique: true,
      sparse: true,
    },

    paidAt: {
      type: Date,
    },

    verifiedAt: {
      type: Date,
    },

    // The charge selection confirmed by the gateway at IPN time — the
    // charges portion only; advanceAmount above is fixed at creation and
    // doesn't need to travel through this.
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

    confirmedBy: {
      type: String,
    },
    confirmedAt: {
      type: Date,
    },

    rejectedAt: {
      type: Date,
    },
    rejectedReason: {
      type:    String,
      default: "",
      trim:    true,
    },
    rejectedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ member: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, verifiedAt: -1 });

// Used by creditService to find a member's completed advance-payment
// deposits efficiently.
paymentSchema.index({ member: 1, advanceAmount: 1, status: 1 });

export default mongoose.model("Payment", paymentSchema);