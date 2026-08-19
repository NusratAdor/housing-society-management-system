// scripts/promoteAdmin.js
// Run AFTER you've registered ADMIN-001 through the real /create-profile
// form on production. Promotes that Member to admin and writes an
// AuditLog entry.
// Usage: node scripts/promoteAdmin.js

import mongoose from "mongoose";
import "dotenv/config";
import Member from "../models/Member.js";
import { writeAuditLog } from "../services/auditService.js";

const DB_NAME = process.env.MONGODB_DB_NAME || "housing_society";

const run = async () => {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

  const member = await Member.findOne({ membershipNo: "123" });
  if (!member) {
    console.log("❌ No member found with membershipNo 123. Register on the site first.");
    process.exit(1);
  }
  if (member.role === "admin") {
    console.log("⚠️  Already an admin. Nothing to do.");
    process.exit(0);
  }

  const before = { role: member.role };
  member.role = "admin";
  await member.save();

  await writeAuditLog({
    action: "MEMBER_ROLE_CHANGED",
    performedBy: "SYSTEM_SEED",
    targetId: member._id,
    description: `Founding admin promoted via seed script: ${member.name} (${member.membershipNo})`,
    before,
    after: { role: "admin" },
  });

  console.log(`✅ ${member.name} (${member.email}) is now an admin.`);
  process.exit(0);
};

run();