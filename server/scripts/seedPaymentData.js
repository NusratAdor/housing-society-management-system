// scripts/seedPaymentData.js
// Run once with:  node scripts/seedPaymentData.js
// This bootstraps the Settings collection and optionally creates test payment records.

import "dotenv/config";
import mongoose from "mongoose";
import Settings from "../models/Settings.js";
import Member   from "../models/Member.js";
import Payment  from "../models/Payment.js";

const MONTHLY_FEE = 500; // change to whatever you want

const run = async () => {
  await mongoose.connect(`${process.env.MONGODB_URI}/housing_society`);
  console.log("✅ Connected to DB");

  // ── 1. Bootstrap the monthly fee setting ──────────────────────────────────
  const existing = await Settings.findOne({ key: "monthlyFee" });
  if (!existing) {
    await Settings.create({ key: "monthlyFee", value: MONTHLY_FEE });
    console.log(`✅ Settings: monthlyFee set to ৳${MONTHLY_FEE}`);
  } else {
    console.log(`ℹ️  Settings: monthlyFee already exists = ৳${existing.value}`);
  }

  // ── 2. For each member, create paid Payment records for last 3 months ──────
  // This makes the "Monthly Payment Status" table show some Paid rows for testing.
  const members = await Member.find({});
  console.log(`Found ${members.length} members`);

  const now = new Date();

  for (const member of members) {
    for (let i = 2; i >= 1; i--) {   // 2 months ago and 1 month ago = Paid
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year  = d.getFullYear();

      const exists = await Payment.findOne({ member: member._id, month, year });
      if (exists) continue;

      await Payment.create({
        member,
        amount:        MONTHLY_FEE,
        month,
        year,
        status:        "Paid",
        method:        "Manual",
        paidAt:        new Date(),
        transactionId: `SEED-${member._id}-${year}-${month}`,
      });
    }
    // Current month = Pending (unpaid — shows in the table as Unpaid)
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    const existsCurrent = await Payment.findOne({
      member: member._id, month: currentMonth, year: currentYear
    });
    if (!existsCurrent) {
      await Payment.create({
        member:        member._id,
        amount:        MONTHLY_FEE,
        month:         currentMonth,
        year:          currentYear,
        status:        "Pending",
        method:        "Manual",
        transactionId: `SEED-${member._id}-${currentYear}-${currentMonth}`,
      });
    }

    // Update dueAmount: 1 unpaid month (current)
    member.dueAmount     = MONTHLY_FEE;
    member.paymentStatus = "Due";
    await member.save();

    console.log(`  ✅ ${member.name}: 2 months paid, current month pending`);
  }

  console.log("\n✅ Seed complete. You can now test the payment dashboard.");
  await mongoose.disconnect();
};

run().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});