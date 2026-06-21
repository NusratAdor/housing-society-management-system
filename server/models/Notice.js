// server/models/Notice.js
import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title:          { type: String, required: true, trim: true },
    date:           { type: Date,   required: true },          // was String — fixed
    summary:        { type: String, required: true, trim: true },
    content:        { type: String, required: true },
    image:          { type: String, default: "" },             // Cloudinary URL
    imagePublicId:  { type: String, default: "" },             // needed for deletion
    createdBy:      { type: String, required: true },          // Clerk userId of admin
  },
  { timestamps: true }
);

export default mongoose.model("Notice", noticeSchema);