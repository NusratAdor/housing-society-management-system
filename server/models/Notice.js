// models/Notice.js
import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: String, required: true }, // Stored as string (e.g., "2025-10-27")
    summary: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String }, // Cloudinary URL
    createdBy: { type: String, required: true }, // Clerk userId of admin
  },
  { timestamps: true }
);

export default mongoose.model("Notice", noticeSchema);