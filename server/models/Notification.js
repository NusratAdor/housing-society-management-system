// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["Member", "Notice", "FAQ", "Gallery", "Question", "MemberUpdate"] },
    content: { type: String, required: true },
    clerkUserId: { type: String },           // <-- for member-specific notifications
    adminOnly: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);