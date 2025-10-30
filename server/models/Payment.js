// models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    // ---- OPTIONAL FOR GATEWAY PAYMENTS ----
    month: {
      type: Number,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      min: 2000,
    },
    // ----------------------------------------
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Rejected"],
      default: "Pending",
    },
    method: {
      type: String,
      enum: ["bKash", "Nagad", "Card", "Bank", "Gateway", "Manual"],
      default: "Gateway",
    },
    paidAt: Date,
    failedReason: String,
    sslValId: String,
    bankTranId: String,
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);