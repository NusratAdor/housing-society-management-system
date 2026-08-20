// server/models/MemberSeat.js
//
// Admin pre-registers membership numbers before a member can sign up.
// This model now holds ONLY what admin actually knows in advance:
// the membership number itself and how far dues are already settled
// outside the digital system. Everything else — name, plotNo,
// designation — is supplied by the member themselves at
// /create-profile, on the real Member document. Duplicating those
// fields here would just create two sources of truth for the same
// data, with no way to know which one is current.
//
// joinDate is set automatically, exactly once, at the moment the seat
// is claimed (see memberController.js) — never admin-entered, never
// in the CSV.
//
// paidThroughMonth — "YYYY-MM" string marking the last month the
// member had already settled dues for, outside the digital system. At
// registration, memberSeatService.generateBackdatedCharges() uses this
// to create real, individually-dated MonthlyCharge records from the
// following month through the current month. Left blank, no backdated
// charges are created — the member starts fresh from their
// registration month.
//
// Any one-off amount owed outside of monthly dues is added after
// registration via the existing custom-charges admin feature
// (ExtraCharge) — unchanged.

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

    // Set automatically at claim time — the exact moment the member
    // completes registration. Never admin/CSV-settable.
    joinDate: {
      type:    Date,
      default: null,
    },

    // "YYYY-MM" (e.g. "2026-03"). Consumed once at seat-claim time by
    // memberSeatService.generateBackdatedCharges; not used afterward.
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

memberSeatSchema.index({ isClaimed: 1 });

export default mongoose.model("MemberSeat", memberSeatSchema);