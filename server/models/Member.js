import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    designation: { type: String, required: true },
    membershipNo: { type: String, required: true },
    plotNo: { type: String, required: true },
    paymentStatus: { type: String, default: "Pending" },
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);