// server/models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "Member", "Notice", "FAQ", "Gallery",
        "Question", "MemberUpdate", "Payment", "AdminApproved", "AdminRejected",
      ],
    },
    content:     { type: String, required: true },
    clerkUserId: { type: String, default: null, index: true },  // null = broadcast
    adminOnly:   { type: Boolean, default: true },
  },
  { timestamps: true }   // provides createdAt and updatedAt automatically
);

export default mongoose.model("Notification", notificationSchema);