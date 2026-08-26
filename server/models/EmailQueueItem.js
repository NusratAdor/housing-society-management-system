// server/models/EmailQueueItem.js
//
// A durable queue for non-urgent bulk emails (due reminders). Instead
// of sending directly and risking exceeding Resend's daily cap, these
// get enqueued here and drained by a daily dispatcher that respects a
// safe daily budget — carrying over anything unsent to the next day
// rather than dropping it silently.

import mongoose from "mongoose";

const emailQueueItemSchema = new mongoose.Schema(
  {
    to:      { type: String, required: true },
    subject: { type: String, required: true },
    type:    { type: String, enum: ["due_reminder"], required: true },
    // Enough context to rebuild the email at send time, without
    // re-querying live data that may have changed since enqueue time —
    // the due amounts shown should reflect what was true when queued.
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status:  { type: String, enum: ["pending", "sent", "failed"], default: "pending", index: true },
    sentAt:  { type: Date },
    error:   { type: String },
  },
  { timestamps: true }
);

emailQueueItemSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("EmailQueueItem", emailQueueItemSchema);