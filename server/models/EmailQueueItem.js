// server/models/EmailQueueItem.js
//
// One shared waiting line for every non-instant email: payment
// confirmations, credit-applied notices and due reminders. They share one
// daily safe-sending budget (see paymentJobs.js dispatcher).
//
// CHANGE (this pass): added "credit_applied" (monthly fee paid from credit).

import mongoose from "mongoose";

const emailQueueItemSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "due_reminder",
        "payment_confirmation",
        "advance_confirmation", // legacy: now rendered by the same statement email
        "credit_applied",
        "credit_shortfall",
      ],
      required: true,
    },
    // Everything needed to rebuild the email at send time, without
    // re-querying data that may have changed since it was queued.
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date },
    error: { type: String },
    retryCount: { type: Number, default: 0 },
        // Optional idempotency key: one email per business event, independent of
    // whether the in-app notification already exists.
    dedupeKey:  { type: String, trim: true },
  },
  { timestamps: true },
);

emailQueueItemSchema.index({ status: 1, createdAt: 1 });
emailQueueItemSchema.index({ type: 1, status: 1 });
emailQueueItemSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

export default mongoose.model("EmailQueueItem", emailQueueItemSchema);
