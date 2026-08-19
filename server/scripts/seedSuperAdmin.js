// scripts/seedSuperAdmin.js
// Run ONCE against production.
// Usage: node scripts/seedSuperAdmin.js your-real-email@example.com

import mongoose from "mongoose";
import "dotenv/config";
import StaffAccount from "../models/StaffAccount.js";
import { writeAuditLog } from "../services/auditService.js";

const DB_NAME = process.env.MONGODB_DB_NAME || "housing_society";
const email = process.argv[2];

const run = async () => {
  if (!email) {
    console.log("❌ Usage: node scripts/seedSuperAdmin.js <email>");
    process.exit(1);
  }

  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

  const existing = await StaffAccount.findOne({ role: "super_admin", active: true });
  if (existing) {
    console.log(`❌ An active Super Admin already exists (${existing.email}). Aborting.`);
    process.exit(1);
  }

  const staff = await StaffAccount.create({
    email: email.trim().toLowerCase(),
    role: "super_admin",
    assignedBy: "SYSTEM_SEED",
    active: true,
    clerkUserId: null,
  });

  await writeAuditLog({
    action: "STAFF_INVITED",
    performedBy: "SYSTEM_SEED",
    targetId: staff._id,
    description: `Founding Super Admin seeded: ${staff.email}`,
    after: { email: staff.email, role: "super_admin" },
  });

  console.log(`✅ Super Admin seat created for ${staff.email}.`);
  console.log("Sign in with that exact Clerk account (verified email) to activate it.");
  process.exit(0);
};

run();