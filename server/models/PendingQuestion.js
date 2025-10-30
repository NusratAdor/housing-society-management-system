// models/PendingQuestion.js
import mongoose from "mongoose";

const pendingQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  clerkUserId: { type: String, required: true },
  askedBy: { type: String },
  askedAt: { type: Date, default: Date.now },
});

export default mongoose.model("PendingQuestion", pendingQuestionSchema);