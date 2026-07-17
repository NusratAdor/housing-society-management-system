// server/models/MonthlyCharge.js
//
// One record per member per calendar month.
// Created by the cron job on the 1st of each month.
//
// The amount field is locked at creation time from FeeHistory.
// It NEVER changes, even if the admin later updates the monthly fee.
// This is what makes historical dues financially accurate.
//
// Design decision — why store status here if due is computed:
//   We cache status ("Unpaid"/"Paid") on the charge itself after
//   PaymentAllocation is created. This lets us query
//   "all unpaid charges for member X" without joining PaymentAllocation.
//   The status is always updated atomically alongside the allocation
//   inside a MongoDB transaction — it can never drift out of sync.
//
// REVERTED: the (0, 0) sentinel month/year pair and the `label` field
// that were added to support an Opening Balance charge on this model
// are gone. Opening Balance is not a calendar-month charge and doesn't
// belong here — it's now a proper ExtraCharge record instead
// (see memberController.js). This schema goes back to representing
// exactly one thing: a real monthly charge for a real month/year.

import mongoose from "mongoose";

const monthlyChargeSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    // 1–12 only — a real calendar month.
    month: {
      type:     Number,
      required: true,
      min:      [1, "Month must be between 1 and 12"],
      max:      [12, "Month must be between 1 and 12"],
    },

    // A real year — no sentinel values permitted.
    year: {
      type:     Number,
      required: true,
      min:      [2020, "Year must be 2020 or later"],
    },

    // Locked at creation from FeeHistory — never changes after creation.
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Charge amount must be at least 1 BDT"],
    },

    // Cached status — updated atomically inside allocatePayment transaction
    // "Unpaid" → no PaymentAllocation covers this charge yet
    // "Paid"   → a PaymentAllocation fully covers this charge
    status: {
      type:    String,
      enum:    ["Unpaid", "Paid"],
      default: "Unpaid",
    },

    // Set when status transitions to "Paid" — for display in history
    paidAt: {
      type: Date,
    },

    // Reference to the Payment that cleared this charge
    // Set when status transitions to "Paid"
    clearedByPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Payment",
    },
  },
  {
    timestamps: true,
  }
);

// UNIQUE constraint: one charge per member per month/year combination
// Prevents the cron job from creating duplicate charges if it runs twice.
monthlyChargeSchema.index(
  { member: 1, month: 1, year: 1 },
  { unique: true }
);

// Most common query: all unpaid charges for a member (for due calculation)
monthlyChargeSchema.index({ member: 1, status: 1 });

// For the 12-month history display — sorted by year/month
monthlyChargeSchema.index({ member: 1, year: -1, month: -1 });

export default mongoose.model("MonthlyCharge", monthlyChargeSchema);