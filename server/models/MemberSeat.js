// server/models/MemberSeat.js
//
// Admin pre-registers membership numbers before a member can sign up.
//
// CHANGE (this pass): openingBalance removed entirely. Replaced with
// paidThroughMonth — a single "YYYY-MM" string marking the last month
// the member had already settled dues for, outside the digital system.
// At registration, memberSeatService.generateBackdatedCharges() uses this
// to create real, individually-dated MonthlyCharge records from the
// following month through the current month — catching the member up to
// present with correctly fee-locked charges, rather than a single lump
// "opening balance" figure. Left blank, no backdated charges are created
// at all — the member simply starts fresh from their registration month.
//
// Any one-off amount owed outside of monthly dues (e.g. a specific past
// incident) is added after registration via the existing custom-charges
// admin feature (ExtraCharge) — unchanged.

import mongoose from "mongoose";

const memberSeatSchema = new mongoose.Schema(
  {
    membershipNo: {
      type:      String,
      required:  true,
      unique:    true,
      trim:      true,
      uppercase: true,
    },

    name: {
      type:     String,
      required: true,
      trim:     true,
    },

    // Comma-separated for members with multiple plots — e.g. "Plot-1, Plot-3"
    plotNo: {
      type:    String,
      default: "",
      trim:    true,
    },

    designation: {
      type:    String,
      default: "",
      trim:    true,
    },

    // Optional — only drives "Member since" display. Falls back to
    // Member.createdAt (digital signup date) when not provided.
    joinDate: {
      type:    Date,
      default: null,
    },

    // Optional — "YYYY-MM" (e.g. "2026-03"). Last month the member had
    // already settled dues for, outside the digital system. Consumed
    // once at seat-claim time by memberSeatService.generateBackdatedCharges;
    // not used afterward.
    paidThroughMonth: {
      type:    String,
      default: null,
      trim:    true,
      validate: {
        validator: (v) => v === null || /^\d{4}-(0[1-9]|1[0-2])$/.test(v),
        message:   "paidThroughMonth must be in YYYY-MM format",
      },
    },

    isClaimed: {
      type:    Boolean,
      default: false,
    },

    claimedByClerkId: {
      type:    String,
      default: null,
    },

    claimedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

memberSeatSchema.index({ membershipNo: 1 }, { unique: true });
memberSeatSchema.index({ isClaimed: 1 });

export default mongoose.model("MemberSeat", memberSeatSchema);