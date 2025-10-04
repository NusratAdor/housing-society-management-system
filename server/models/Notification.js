import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    memberId: { type: String, ref: "Member", required: true },
    message: { type: String, required: true },
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;