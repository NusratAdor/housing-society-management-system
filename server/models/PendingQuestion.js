// server/models/PendingQuestion.js
//
// CHANGES:
//   - deletedByMember: member can cancel their pending question
//     before admin answers. Sets this true rather than hard-deleting,
//     so admin can still see it was submitted and withdrawn.
//   - Admin delete is still a hard delete from ManageFAQs — pending
//     questions are low-value transient records, no audit need.

import mongoose from "mongoose";

const pendingQuestionSchema = new mongoose.Schema(
  {
    question:        { type: String,  required: true },
    clerkUserId:     { type: String,  required: true },
    askedBy:         { type: String,  default: "Member" },
    deletedByMember: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Virtual — keeps API response shape consistent with FAQ model
pendingQuestionSchema.virtual("askedAt").get(function () {
  return this.createdAt;
});

pendingQuestionSchema.set("toJSON", { virtuals: true });

export default mongoose.model("PendingQuestion", pendingQuestionSchema);