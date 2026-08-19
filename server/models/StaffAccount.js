// server/models/StaffAccount.js
//
// Independent of Member by design — Super Admin is explicitly not a
// member, and Content Manager is staff, not a resident. This collection
// never touches MemberSeat, dues, or payments, and nothing in that
// pipeline needs to know it exists.
//
// clerkUserId is nullable: a Super Admin invite is created by email
// first (clerkUserId: null) and gets linked automatically the first
// time that person signs in with a matching VERIFIED Clerk email
// (see staffController.getStaffProfile).

import mongoose from "mongoose";

const staffAccountSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      trim: true,
      default: null,
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
    // Clerk userId of the Super Admin who granted this role — audit trail.
    assignedBy: {
      type: String,
      required: true,
    },
    // Soft-revoke flag. Never hard-deleted — history stays intact for audit.
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Only one ACTIVE staff record per email at a time — prevents duplicate
// live invites. A revoked (active:false) record doesn't block a fresh
// re-invite to the same email later.
staffAccountSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

// clerkUserId must be unique once linked, but many pending (null)
// invites can coexist — sparse index skips null values entirely.
staffAccountSchema.index({ clerkUserId: 1 }, { unique: true, sparse: true });

staffAccountSchema.index({ role: 1, active: 1 });

export default mongoose.model("StaffAccount", staffAccountSchema);