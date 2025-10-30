// models/FAQ.js
import mongoose from "mongoose";

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String },
  askedBy: { type: String },
  clerkUserId: { type: String }, // <-- ADD THIS
  askedAt: { type: Date, default: Date.now },
  answeredAt: { type: Date },
});

export default mongoose.model("FAQ", faqSchema);