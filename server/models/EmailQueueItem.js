// server/models/EmailQueueItem.js
//
// One shared waiting line for every non-instant email the system sends
// — payment confirmations, advance/credit confirmations, and due
// reminders. All three types share one daily safe-sending budget so
// the system never accidentally goes over Resend's real daily limit,
// no matter which combination of emails a given day needs.
//
// retryCount lets a temporarily-failed send (e.g. a brief network
// hiccup) be tried again automatically on the next dispatch cycle,
// instead of that member simply never getting their email.

import mongoose from "mongoose";

const emailQueueItemSchema = new mongoose.Schema(
  {
    to:      { type: String, required: true },
    subject: { type: String, required: true },
    type: {
      type:     String,
      enum:     ["due_reminder", "payment_confirmation", "advance_confirmation"],
      required: true,
    },
    // Enough context to rebuild the email at send time, without
    // re-querying live data that may have changed since enqueue time —
    // the amounts shown should reflect what was true when queued.
    payload:    { type: mongoose.Schema.Types.Mixed, required: true },
    status:     { type: String, enum: ["pending", "sent", "failed"], default: "pending", index: true },
    sentAt:     { type: Date },
    error:      { type: String },
    // Automatic-retry counter — a send is retried (stays "pending")
    // up to MAX_RETRY_ATTEMPTS times before being marked permanently
    // "failed". See paymentJobs.js dispatcher.
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

emailQueueItemSchema.index({ status: 1, createdAt: 1 });
emailQueueItemSchema.index({ type: 1, status: 1 });

export default mongoose.model("EmailQueueItem", emailQueueItemSchema);