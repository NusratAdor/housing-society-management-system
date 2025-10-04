import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    summary: { type: String },
    date: { type: Date, default: Date.now },
    image: { type: String },
    content: { type: String },
  },
  { timestamps: true }
);

const Notice = mongoose.model("Notice", noticeSchema);

export default Notice;