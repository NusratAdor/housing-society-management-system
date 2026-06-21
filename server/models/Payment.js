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
// Why separation matters:
//   A payment of 1200 might clear Jan(500) + Feb(500) + Generator(200).
//   Without PaymentAllocation, you cannot reconstruct this audit trail.
//   With it, every cent is traceable to an exact charge.

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
    // "completed" → confirmed by IPN callback + SSLCommerz validation API
    // "failed"    → gateway reported failure
    // "rejected"  → admin manually rejected with a reason
    status: {
      type:    String,
      enum:    ["pending", "completed", "failed", "rejected"],
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

    // Human-readable receipt number generated after payment completes
    // Format: RCP-YYYY-NNNNNN (e.g. RCP-2025-000123)
    // Unique, sparse — null until payment completes
    receiptNumber: {
      type:   String,
      unique: true,
      sparse: true, // allows multiple null values (pending payments)
    },

    paidAt: {
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
  },
  {
    timestamps: true,
  }
);

// Common query: all payments for a member by status
paymentSchema.index({ member: 1, status: 1 });


// Admin pending payments queue
paymentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Payment", paymentSchema);