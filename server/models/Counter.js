// server/models/Counter.js — NEW FILE
// A tiny atomic counter collection. Used only for receipt numbering —
// MongoDB's findOneAndUpdate with $inc is atomic even under heavy
// concurrency, which the previous countDocuments-based approach was not.

import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.model("Counter", counterSchema);