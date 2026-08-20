// scripts/seedAdmin.js
// Run ONCE against production. Creates the first MemberSeat only.
// Usage: node scripts/seedAdmin.js

import mongoose from "mongoose";
import "dotenv/config";
import Member from "../models/Member.js";
import MemberSeat from "../models/MemberSeat.js";

const DB_NAME = process.env.MONGODB_DB_NAME || "housing_society";

const run = async () => {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log(`Connected to ${DB_NAME}`);

  const existingAdmin = await Member.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log(`❌ Admin already exists (${existingAdmin.email}). Aborting.`);
    process.exit(1);
  }

  const existingSeat = await MemberSeat.findOne({ membershipNo: "ADMIN-001" });
  if (existingSeat) {
    console.log(`⚠️  Seat ADMIN-001 already exists (isClaimed: ${existingSeat.isClaimed}). Skipping creation.`);
  } else {
    await MemberSeat.create({
      membershipNo: "123",
      name: "Nusrat Jahan",
      plotNo: "plot-1",
      paidThroughMonth: "2025-12",
      isClaimed: false,
    });
    console.log("✅ MemberSeat 123 created.");
  }

  console.log("Next: sign up on the LIVE site using membershipNo ADMIN-001.");
  console.log("Then run: node scripts/promoteAdmin.js");
  process.exit(0);
};

run();