// models/Member.js
import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    designation: { type: String, required: true },
    membershipNo: { type: String, required: true, trim: true, unique: true },
    plotNo: { type: String, required: true, trim: true },
    paymentStatus: { 
      type: String, 
      enum: ["Pending", "Paid", "Due"], 
      default: "Pending" 
    },
    dueAmount: { type: Number, default: 0 }, // NEW
    role: { type: String, enum: ["member", "admin"], default: "member" },
    pendingAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);