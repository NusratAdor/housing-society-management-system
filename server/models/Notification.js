// server/models/Notification.js
//
// CHANGE (this pass): optional `eventKey` makes system notifications idempotent.
// Example: "CREDIT_APPLIED:<chargeId>". A cron rerun or retry can never create
// the same message twice. The partial index only covers documents that have a
// string eventKey, so every existing notification is unaffected.

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "Member",
        "Notice",
        "FAQ",
        "Gallery",
        "Question",
        "MemberUpdate",
        "Payment",
        "AdminApproved",
        "AdminRejected",
        "ServiceRequest",
      ],
    },
    content: { type: String, required: true },
    clerkUserId: { type: String, default: null, index: true }, // null = broadcast
    adminOnly: { type: Boolean, default: true },
    eventKey: { type: String, trim: true },
    // Clerk ids that have read this notification. Works for personal and
    // broadcast notifications. Never sent to clients (select: false).
    readBy: { type: [String], default: undefined, select: false },
  },

  { timestamps: true },
);

notificationSchema.index(
  { eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } },
);

export default mongoose.model("Notification", notificationSchema);
