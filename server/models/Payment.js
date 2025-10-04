import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    memberId: { type: String, ref: "Member", required: true },
    amount: { type: Number, default: 300 },
    date: { type: Date, required: true },
    status: { type: String, enum: ["Paid", "Due", "Pending"], default: "Due" },
    month: { type: String, required: true }, // e.g., '2025-07'
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;