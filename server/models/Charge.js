// models/Charge.js
import mongoose from "mongoose";
const chargeSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    label: { type: String, required: true, trim: true },   // e.g. "Generator maintenance"
    amount: { type: Number, required: true, min: 1 },
    dueDate: { type: Date },                               // optional deadline
    status: {
      type: String,
      enum: ["Unpaid", "Paid", "Cancelled"],
      default: "Unpaid",
    },
    createdBy: { type: String, required: true },           // admin clerkUserId
    paidViaPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
  },
  { timestamps: true }
);
export default mongoose.model("Charge", chargeSchema);  
