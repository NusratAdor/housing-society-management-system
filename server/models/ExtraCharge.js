// server/models/ExtraCharge.js
//
// Admin-initiated one-off charges assigned to one or more members.
// Examples: generator repair, festival donation, security upgrade.
//
// CHANGE (this pass): partialPaymentAllowed and originalAmount removed.
// Those existed solely to support the old Opening Balance feature (a
// partially-payable lump-sum charge), which has been replaced by
// memberSeatService's backdated real MonthlyCharge generation. No
// remaining charge type in the system uses partial payment — every
// ExtraCharge is paid in full, as it always was before that feature
// was introduced.
//
// When admin creates a charge targeting 50 members, 50 ExtraCharge
// documents are created — one per member. This design means:
//   - Each member's charge can be cancelled independently
//   - Each charge has its own payment allocation record
//   - Each charge tracks its own payment status independently

import mongoose from "mongoose";

const extraChargeSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    label: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },

    purpose: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 1000,
    },

    amount: {
      type:     Number,
      required: true,
      min:      [1, "Charge amount must be at least 1 BDT"],
    },

    dueDate: {
      type: Date,
    },

    status: {
      type:    String,
      enum:    ["Unpaid", "Paid", "Cancelled"],
      default: "Unpaid",
    },

    paidAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },

    cancelReason: {
      type:    String,
      default: "",
      trim:    true,
    },

    createdBy: {
      type:     String,
      required: true,
      trim:     true,
    },

    clearedByPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Payment",
    },

    batchId: {
      type:  String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

extraChargeSchema.index({ member: 1, status: 1 });
extraChargeSchema.index({ createdAt: -1 });

export default mongoose.model("ExtraCharge", extraChargeSchema);