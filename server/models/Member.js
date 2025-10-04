import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String },
    designation: { type: String },
    email: { type: String, required: true },
    phone: { type: String },
    membershipNumber: { type: String, required: true, unique: true },
    plotNumber: { type: String },
    paymentStatus: { type: String, enum: ["Due", "Paid"], default: "Due" },
  },
  { timestamps: true }
);

const Member = mongoose.model("Member", memberSchema);

export default Member;