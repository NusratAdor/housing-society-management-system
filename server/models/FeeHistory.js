// server/models/FeeHistory.js
//
// Append-only log of every monthly fee change.
// Records are NEVER updated after creation — only new ones are inserted.
//
// To find the fee that applied in a given month:
//   Find the record with the highest effectiveFrom that is <= the first
//   day of the target month. This is handled by getFeeForMonth() in
//   paymentService.js.
//
// Why this design instead of a single Settings record:
//   A single record tells you what the fee is NOW.
//   It cannot tell you what it was in January.
//   An append-only log gives you that answer for any month in history,
//   which is required for locking MonthlyCharge amounts at creation time.

import mongoose from "mongoose";

const feeHistorySchema = new mongoose.Schema(
  {
    // The fee amount in BDT — locked forever once created
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Fee must be at least 1 BDT"],
    },

    // The first day of the month from which this fee becomes active.
    // Always stored as midnight UTC on the 1st of the month.
    // Example: fee effective from April 2025 → 2025-04-01T00:00:00.000Z
    // This makes range queries unambiguous regardless of timezone.
    effectiveFrom: {
      type:     Date,
      required: true,
    },

    // Clerk userId of the admin who made this change — for audit purposes
    createdBy: {
      type:     String,
      required: true,
      trim:     true,
    },

    // Optional human-readable explanation — admin can note why fee changed
    reason: {
      type:    String,
      default: "",
      trim:    true,
      maxlength: 500,
    },
  },
  {
    // timestamps adds createdAt and updatedAt automatically
    // createdAt is when the admin made the change — useful for audit display
    timestamps: true,
  }
);

// Primary query pattern: "what was the fee on date X?"
// Descending index so findOne().sort({ effectiveFrom: -1 }) hits the index
feeHistorySchema.index({ effectiveFrom: -1 });

// Prevent duplicate records for the same effective date
// Two fee changes cannot take effect on the same day
feeHistorySchema.index({ effectiveFrom: 1 }, { unique: true });

export default mongoose.model("FeeHistory", feeHistorySchema);