// server/models/AuditLog.js
//
// Immutable log of every admin action that affects financial state or
// member data. Records are NEVER updated or deleted.
//
// Why a dedicated AuditLog instead of relying on timestamps and changelogs:
//   - Single place to answer "who did what and when"
//   - Captures BEFORE and AFTER state for every change
//   - Required for any financial system used in a dispute or audit
//   - Cannot be tampered with through normal application flows
//   - Can be reviewed without joining multiple collections

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // What type of action was performed
    action: {
      type:     String,
      required: true,
      enum: [
        "FEE_CHANGED",          // admin changed monthly fee
        "CHARGE_CREATED",       // admin created extra charge(s)
        "CHARGE_CANCELLED",     // admin cancelled an extra charge
        "PAYMENT_APPROVED",     // admin manually approved a payment
        "PAYMENT_REJECTED",     // admin rejected a payment
        "MEMBER_ROLE_CHANGED",  // admin changed a member's role
        "MEMBER_UPDATED",       // admin updated member profile
        "MEMBER_DELETED",       // admin deleted a member
        "MONTHLY_DUES_ADDED",   // cron job added monthly dues
      ],
    },

    // Clerk userId of the admin who performed this action
    // "SYSTEM" for cron-initiated actions
    performedBy: {
      type:     String,
      required: true,
    },

    // The MongoDB _id of the primary entity affected (member, charge, payment, etc.)
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Human-readable description of what changed
    description: {
      type:     String,
      required: true,
    },

    // Snapshot of the data BEFORE this action (for reversibility and audit)
    // Stored as Mixed so it can hold any shape of data
    before: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Snapshot of the data AFTER this action
    after: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Any extra context needed to understand this log entry
    // Example: { batchId: "abc", membersAffected: 47 } for CHARGE_CREATED
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    // updatedAt intentionally excluded — these records never change
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Admin audit dashboard — most recent actions first
auditLogSchema.index({ createdAt: -1 });

// Filter by action type
auditLogSchema.index({ action: 1, createdAt: -1 });

// Filter by who performed the action
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

// Filter by which entity was affected
auditLogSchema.index({ targetId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);