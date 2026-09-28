// server/scripts/seedReceiptCounter.js
// Run ONCE, before deploying the atomic-counter receipt numbering fix.
// Uses max(completed-payment-count, highest-existing-receipt-sequence)
// — NOT payment count alone — since a gap in existing receipt numbers
// (a past rejected/retried transaction, manual cleanup, etc.) could
// otherwise let the counter start too low and immediately collide with
// an already-issued receipt number.

import mongoose from "mongoose";
import "dotenv/config";
import Payment from "../models/Payment.js";
import Counter from "../models/Counter.js";

const DB_NAME = process.env.MONGODB_DB_NAME || "housing_society";

const run = async () => {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

  const existing = await Counter.findOne({ _id: "receipt-sequence" });
  if (existing) {
    console.log(`❌ Counter already exists (seq: ${existing.seq}). Aborting — this script is for first-time setup only.`);
    process.exit(1);
  }

  const completedCount = await Payment.countDocuments({ status: "completed" });

  const allReceipts = await Payment
    .find({ status: "completed", receiptNumber: { $exists: true, $ne: null } })
    .select("receiptNumber")
    .lean();

  const highestSeq = allReceipts.reduce((max, p) => {
    const match = p.receiptNumber?.match(/-(\d{6})$/);
    const seq   = match ? parseInt(match[1], 10) : 0;
    return Math.max(max, seq);
  }, 0);

  const seedValue = Math.max(completedCount, highestSeq);

  await Counter.create({ _id: "receipt-sequence", seq: seedValue });

  console.log(`✅ Receipt counter seeded at ${seedValue} (completed count: ${completedCount}, highest existing sequence: ${highestSeq})`);
  process.exit(0);
};

run();