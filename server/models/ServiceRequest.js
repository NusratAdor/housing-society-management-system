import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    serviceType: { type: String, enum: ["guest-house", "water", "electrical"], required: true },
    status: { type: String, enum: ["new", "done"], default: "new" },

    // Water / electrical
    plot: { plotNo: String, plotSize: Number },
    issueType: { type: String, trim: true, maxlength: 60 },

    // Guest house. Dates are "YYYY-MM-DD" text, so there are no timezone shifts.
    stay: {
      checkIn: String,
      checkOut: String,
      guestName: { type: String, trim: true, maxlength: 100 },
      guests: Number,
      contactNumber: String,
      purpose: { type: String, trim: true, maxlength: 200 },
    },

    details: { type: String, trim: true, maxlength: 1000, default: "" },

    handledBy: String,
    handledAt: Date,
  },
  { timestamps: true },
);

serviceRequestSchema.index({ createdAt: -1 });

export default mongoose.model("ServiceRequest", serviceRequestSchema);