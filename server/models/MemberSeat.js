import mongoose from "mongoose";

const memberSeatSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────────────────────────────
    // Membership number supplied by admin / society CSV
    // ─────────────────────────────────────────────────────────────
    membershipNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [
    /^\d+$/,
    "Membership number must contain digits only",
  ],
    },
    // ─────────────────────────────────────────────────────────────
    // Original registered phone supplied by admin / society CSV.
    //
    // Stored in canonical international E.164 format:
    // +8801712345678
    // +14155552671
    // +442071234567
    //
    // IMPORTANT:
    // This value must never be changed by the member themselves.
    // It is the registration eligibility credential.
    // ─────────────────────────────────────────────────────────────
    registeredPhone: {
      type: String,
      required: true,
      trim: true,
    },

    // ─────────────────────────────────────────────────────────────
    // Last month whose monthly fee was already paid before this
    // system started managing the member.
    //
    // Example:
    // "2026-09"
    //
    // If current month = 2026-10:
    // system creates October charge.
    //
    // If current month = 2026-09:
    // no backdated charge is created.
    // ─────────────────────────────────────────────────────────────
    paidThroughMonth: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value),

        message: "paidThroughMonth must be in YYYY-MM format",
      },
    },

    // ─────────────────────────────────────────────────────────────
    // Set automatically when registration succeeds.
    // Admin does not enter this.
    // ─────────────────────────────────────────────────────────────
    joinDate: {
      type: Date,
      default: null,
    },

    // ─────────────────────────────────────────────────────────────
    // Registration claim state
    // ─────────────────────────────────────────────────────────────
    isClaimed: {
      type: Boolean,
      default: false,
    },

    claimedByClerkId: {
      type: String,
      default: null,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    // ─────────────────────────────────────────────────────────────
    // Retired membership numbers can never be reused.
    // ─────────────────────────────────────────────────────────────
    isRetired: {
      type: Boolean,
      default: false,
    },

    retiredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────
// Useful for admin filtering.
memberSeatSchema.index({ isClaimed: 1 });

// Useful for retired-seat filtering.
memberSeatSchema.index({ isRetired: 1 });

export default mongoose.model("MemberSeat", memberSeatSchema);
