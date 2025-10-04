import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    askedBy: { type: String, required: true },
    askedAt: { type: Date, default: Date.now },
    answered: { type: Boolean, default: false },
    answer: { type: String },
    memberId: { type: String, ref: "Member", required: true },
  },
  { timestamps: true }
);

const Question = mongoose.model("Question", questionSchema);

export default Question;
