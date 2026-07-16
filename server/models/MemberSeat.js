// server/models/MemberSeat.js

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
    plotNo: {
      type:    String,
      trim:    true,
      default: "",
      // Multiple plots stored as comma-separated: "Plot-1, Plot-3"
    },
    designation: {
      type:    String,
      trim:    true,
      default: "",
    },

    // OPTIONAL — physical society join date.
    // Used only for "Member since" display in the dashboard.
    // If not available (old members with no records), falls back
    // to Member.createdAt (the digital signup date).
    // Does NOT drive any charge calculation — opening balance handles that.
    joinDate: {
      type:    Date,
      default: null,
    },

    // Opening balance from CSV — total amount owed at migration time.
    // Applied as a single "Opening Balance" MonthlyCharge when the
    // member first completes their profile, so the existing payment
    // system works without any changes.
    // 0 = fully paid up at time of migration.
    openingBalance: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // Claim tracking
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