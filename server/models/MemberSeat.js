// server/models/MemberSeat.js
//
// A MemberSeat is a pre-registration record created by admin before
// a member signs up. It acts as an allowlist — only members whose
// membership number exists here can complete profile creation.
//
// joinDate drives backdated due generation: all months from joinDate
// to the current month are created as MonthlyCharge records when the
// member first claims this seat.
//
// Once claimed, membershipNo and joinDate are locked — they should
// not be changed because charges have already been generated from them.
// Admin can still update name, plotNo, designation (display fields only).

import mongoose from "mongoose";

const memberSeatSchema = new mongoose.Schema(
  {
    membershipNo: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
      uppercase: true,
    },
    name: {
      type:  String,
      required: true,
      trim:  true,
    },
    plotNo: {
      type:  String,
      trim:  true,
      default: "",
    },
    designation: {
      type:  String,
      trim:  true,
      default: "",
    },
    // The month the member officially joined the society.
    // All MonthlyCharge records will be generated from this date forward.
    // Admin sets this to the actual physical join date, not the digital signup date.
    joinDate: {
      type:     Date,
      required: true,
    },

    // ── Claim tracking ──────────────────────────────────────────────────────
    // isClaimed flips to true the moment a member completes CreateProfile
    // with this membershipNo. After that, the seat is locked.
    isClaimed: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    claimedByClerkId: {
      type:    String,
      default: null,
    },
    claimedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("MemberSeat", memberSeatSchema);