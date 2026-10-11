// server/models/AuditLog.js
//
// Immutable log of every action that affects financial state or member data.
// Records are NEVER updated or deleted.
//
// CHANGE (this pass):
//   1. Added PAYMENT_CREDIT_APPLIED to the enum. creditService writes this
//      action inside a transaction with required:true. Without it in the enum
//      the audit insert failed validation, which rolled back every credit
//      application.
//   2. Append-only is now enforced in code (update/delete hooks), not only by
//      convention. The strongest protection is still a MongoDB database user
//      that has no update/delete rights on this collection.

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "FEE_CHANGED",
        "CHARGE_CREATED",
        "CHARGE_CANCELLED",
        "PAYMENT_APPROVED",
        "PAYMENT_REJECTED",
        "PAYMENT_CREDIT_APPLIED",
        "ADMIN_REQUEST_APPROVED",
        "ADMIN_REQUEST_REJECTED",
        "MEMBER_UPDATED",
        "MEMBER_REMOVED",
        "MEMBER_ROLE_CHANGED",
        "MONTHLY_DUES_ADDED",
        "STAFF_INVITED",
        "STAFF_ROLE_CHANGED",
        "STAFF_REVOKED",
        "MEMBER_REGISTERED",
        "SEAT_CREATED",
        "SEAT_UPDATED",
        "SEAT_DELETED",
        "SEAT_IMPORTED",
        "STAFF_ACTIVATED",
      ],
    },

    // Clerk userId of the admin who performed this action.
    // "SYSTEM" for cron-initiated actions.
    performedBy: {
      type: String,
      required: true,
    },

    // _id of the primary entity affected (member, charge, payment, etc.)
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    description: {
      type: String,
      required: true,
    },

    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    // updatedAt intentionally excluded — these records never change
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });

// ─── Append-only enforcement ────────────────────────────────────────────────
const APPEND_ONLY_ERROR =
  "AuditLog is append-only: records cannot be changed or deleted.";

[
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
].forEach((op) => {
  auditLogSchema.pre(op, { document: false, query: true }, function (next) {
    next(new Error(APPEND_ONLY_ERROR));
  });
});

// Re-saving an existing document would be an update.
auditLogSchema.pre("save", function (next) {
  if (!this.isNew) return next(new Error(APPEND_ONLY_ERROR));
  next();
});

auditLogSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function (next) {
    next(new Error(APPEND_ONLY_ERROR));
  },
);

export default mongoose.model("AuditLog", auditLogSchema);
