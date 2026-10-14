// server/models/StaffAccount.js
//
// Independent of Member by design: Super Admin is not a member, and Content
// Manager is staff, not a resident. This collection never touches MemberSeat,
// dues or payments.
//
// An invite is created by email first (no clerkUserId) and is linked the first
// time that person signs in with a matching VERIFIED Clerk email
// (see staffController.getStaffProfile).

import mongoose from "mongoose";

const staffAccountSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    role: {
      type: String,
      required: true,
      enum: ["super_admin", "content_manager"],
    },
    // Clerk userId of the Super Admin who granted this role (audit trail).
    assignedBy: {
      type: String,
      required: true,
    },
    // Soft-revoke flag. Never hard-deleted: history stays for audit.
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// One ACTIVE record per email. A revoked record doesn't block a re-invite.
staffAccountSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

// One ACTIVE record per Clerk user. A revoked record keeps its clerkUserId as
// history, so it must NOT count: otherwise re-inviting the same person fails.
// This replaces the old index "clerkUserId_1". Drop that one once:
//   db.staffaccounts.dropIndex("clerkUserId_1")
staffAccountSchema.index(
  { clerkUserId: 1 },
  {
    name: "unique_active_clerk_user",
    unique: true,
    partialFilterExpression: { active: true, clerkUserId: { $type: "string" } },
  },
);

staffAccountSchema.index({ role: 1, active: 1 });

export default mongoose.model("StaffAccount", staffAccountSchema);