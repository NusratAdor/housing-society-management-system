// server/models/Member.js
//
// Member profile only.
//
// WHY dueAmount and paymentStatus are NOT here:
//   These are computed values derived from MonthlyCharge, ExtraCharge,
//   and PaymentAllocation. Storing them creates a cached copy that can
//   drift out of sync with the financial records — and once it drifts,
//   you have no way to know which is correct.
//
//   Due amount is computed as:
//     SUM(MonthlyCharge.amount where member=X and status="Unpaid")
//     + SUM(ExtraCharge.amount where member=X and status="Unpaid")
//
//   Payment status is derived as:
//     totalDue === 0 ? "Paid" : "Due"
//
//   These queries take <10ms with proper indexes for 500 members.
//   There is no performance reason to store them.
//   There is a strong correctness reason NOT to store them.

import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
    },

    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },

    email: {
      type:      String,
      required:  true,
      unique:    true,
      trim:      true,
      lowercase: true,
    },

    phone: {
      type:     String,
      required: true,
      trim:     true,
    },

    address: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 300,
    },

    designation: {
      type:     String,
      required: true,
      trim:     true,
    },

    membershipNo: {
      type:      String,
      required:  true,
      unique:    true,
      trim:      true,
      uppercase: true,
    },

    plotNo: {
      type:     String,
      required: true,
      trim:     true,
    },

    role: {
      type:    String,
      enum:    ["member", "admin"],
      default: "member",
    },

    pendingAdmin: {
      type:    Boolean,
      default: false,
    },


    // ── Soft delete ─────────────────────────────────────────────────────
    // A member is never actually deleted from this collection. "Removing"
    // a member only ever sets status to "removed" — their profile and
    // every financial record tied to them (Payment, MonthlyCharge,
    // ExtraCharge) stays intact, permanently, for historical/audit
    // purposes. See memberService.deactivateMember.
    status: {
      type:    String,
      enum:    ["active", "removed"],
      default: "active",
    },

    removedAt: {
      type:    Date,
      default: null,
    },

    // Clerk userId of the admin who removed this member, or
    // "SYSTEM_CLERK_WEBHOOK" if the member deleted their own account.
    removedBy: {
      type:    String,
      default: null,
    },





  },
  {
    timestamps: true,
  }
);

// Used by isAdmin middleware for every authenticated admin request
memberSchema.index({ role: 1 });

// Used to filter active vs removed members (dashboards, monthly cron,
// admin listings)
memberSchema.index({ status: 1 });

export default mongoose.model("Member", memberSchema);