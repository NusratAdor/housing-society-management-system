// server/models/PaymentAllocation.js
//
// The financial ledger that links payments to the charges they clear.
// This is the most important model for financial accuracy and auditability.
//
// When payment P clears MonthlyCharge A and ExtraCharge B:
//   PaymentAllocation { payment: P, chargeType: "monthly", chargeId: A, amount: 500 }
//   PaymentAllocation { payment: P, chargeType: "extra",   chargeId: B, amount: 300 }
//
// This means:
//   - You can always answer "what did payment P pay for?"
//   - You can always answer "which payment cleared charge X?"
//   - Due amount = SUM(unpaid charges) — no stored field that can drift
//   - Complete financial audit trail for every transaction
//
// Records in this collection are NEVER updated or deleted.
// They are permanent financial records.

import mongoose from "mongoose";

const paymentAllocationSchema = new mongoose.Schema(
  {
    payment: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Payment",
      required: true,
    },

    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    // Discriminator field — tells us which collection chargeId references
    // "monthly" → chargeId is a MonthlyCharge _id
    // "extra"   → chargeId is an ExtraCharge _id
    chargeType: {
      type:     String,
      enum:     ["monthly", "extra"],
      required: true,
    },

    // The specific charge this allocation covers
    // Dynamic reference — resolves to MonthlyCharge or ExtraCharge
    // based on chargeType
    chargeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      refPath:  "chargeType",
    },

    // Amount allocated from this payment to this charge
    // For monthly charges: always equals the full MonthlyCharge amount
    //   (partial month payments are not allowed)
    // For extra charges: always equals the full ExtraCharge amount
    //   (partial extra charge payments are not allowed)
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Allocation amount must be at least 1 BDT"],
    },

    allocatedAt: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    // No updatedAt needed — these records never change
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Look up all allocations for a payment — used for receipt generation
paymentAllocationSchema.index({ payment: 1 });

// Look up all allocations for a member — used for transaction history
paymentAllocationSchema.index({ member: 1, allocatedAt: -1 });

// Look up which payment cleared a specific charge — used for audit
paymentAllocationSchema.index({ chargeId: 1 });

export default mongoose.model("PaymentAllocation", paymentAllocationSchema);