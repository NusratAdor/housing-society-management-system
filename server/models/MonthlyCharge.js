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
// A monthly charge is either Unpaid or Paid — never partially paid.
// If a member's prepaid credit doesn't fully cover a month (e.g. the
// fee changed after they prepaid), the charge stays Unpaid and the
// shortfall is handled manually by admin via a separate ExtraCharge
// with a clear reason — never by silently marking this charge partial.

import mongoose from "mongoose";

const monthlyChargeSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    month: {
      type:     Number,
      required: true,
      min:      [1, "Month must be between 1 and 12"],
      max:      [12, "Month must be between 1 and 12"],
    },

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

    status: {
      type:    String,
      enum:    ["Unpaid", "Paid"],
      default: "Unpaid",
    },

    paidAt: {
      type: Date,
    },

    clearedByPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Payment",
    },
  },
  {
    timestamps: true,
  }
);

monthlyChargeSchema.index(
  { member: 1, month: 1, year: 1 },
  { unique: true }
);

monthlyChargeSchema.index({ member: 1, status: 1 });
monthlyChargeSchema.index({ member: 1, year: -1, month: -1 });

export default mongoose.model("MonthlyCharge", monthlyChargeSchema);