// server/scripts/seedInitialFee.js
//
// Run ONCE, before any MemberSeat CSV import or member registration.
// Creates the genesis FeeHistory record — the fee that applied for
// every historical month before the system went live. Without this,
// getFeeForMonth() has nothing to find for backdated months, and
// (as of this fix) throws rather than silently guessing a number into
// a permanently-locked MonthlyCharge.amount.
//
// effectiveFrom is fixed to 2020-01-01 — matching MonthlyCharge's own
// schema-enforced minimum year (2020). This guarantees every month
// this system can ever legally record a charge for is covered.
//
// Usage:
//   node -r dotenv/config scripts/seedInitialFee.js 300 dotenv_config_path=.env.production

import mongoose from "mongoose";
import "dotenv/config";
import FeeHistory from "../models/FeeHistory.js";
import { writeAuditLog } from "../services/auditService.js";

const DB_NAME = process.env.MONGODB_DB_NAME || "housing_society";
const amount = Number(process.argv[2]);

const GENESIS_DATE = new Date(Date.UTC(2020, 0, 1));

const run = async () => {
  if (!amount || isNaN(amount) || amount < 1) {
    console.log("❌ Usage: node scripts/seedInitialFee.js <amount>");
    process.exit(1);
  }

  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log(`Connected to ${DB_NAME}`);

  const existingGenesis = await FeeHistory.findOne({ effectiveFrom: GENESIS_DATE });
  if (existingGenesis) {
    console.log(`❌ A genesis fee record already exists (৳${existingGenesis.amount}, effective ${GENESIS_DATE.toISOString()}). Aborting — this script is for first-time setup only.`);
    process.exit(1);
  }

  const anyRecord = await FeeHistory.findOne();
  if (anyRecord) {
    console.log(`⚠️  FeeHistory already has records, but none at the genesis date. This may mean fees were set through the admin panel before running this script — historical months before the earliest existing record will still be uncovered. Proceeding to add the genesis record anyway.`);
  }

  const record = await FeeHistory.create({
    amount,
    effectiveFrom: GENESIS_DATE,
    createdBy: "SYSTEM_SEED",
    reason: "Genesis fee — covers all historical months before digital launch",
  });

  await writeAuditLog({
    action: "FEE_CHANGED",
    performedBy: "SYSTEM_SEED",
    targetId: record._id,
    description: `Genesis monthly fee set to ৳${amount}, effective from ${GENESIS_DATE.toISOString().slice(0, 10)}`,
    after: { amount, effectiveFrom: record.effectiveFrom },
    metadata: { genesis: true },
  });

  console.log(`✅ Genesis fee record created: ৳${amount}, effective from ${GENESIS_DATE.toISOString().slice(0, 10)}`);
  console.log("You can now safely import the MemberSeat CSV and open registration.");
  process.exit(0);
};

run();