// server/scripts/backfillProfileImages.js
// Run ONCE after deploying the webhook change. Existing members hold either
// null or a generated default-avatar URL. This sets profileImageUrl from
// Clerk: the real image, or null (the app then shows initials).
//
// Usage: node scripts/backfillProfileImages.js

import mongoose from "mongoose";
import "dotenv/config";
import { createClerkClient } from "@clerk/express";
import Member from "../models/Member.js";

const DB_NAME = process.env.MONGODB_DB_NAME || "housing_society";
const BATCH = 100;

const run = async () => {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const members = await Member.find({ status: "active" }).select("clerkUserId").lean();
  console.log(`Active members: ${members.length}`);

  let withImage = 0;
  let initialsOnly = 0;
  let missingInClerk = 0;

  for (let i = 0; i < members.length; i += BATCH) {
    const ids = members.slice(i, i + BATCH).map((m) => m.clerkUserId);
    const response = await clerk.users.getUserList({ userId: ids, limit: BATCH });
    const users = Array.isArray(response) ? response : response.data;
    const found = new Set();

    for (const user of users) {
      found.add(user.id);
      const imageUrl = user.hasImage ? user.imageUrl : null;
      await Member.updateOne({ clerkUserId: user.id }, { $set: { profileImageUrl: imageUrl } });
      imageUrl ? (withImage += 1) : (initialsOnly += 1);
    }
    missingInClerk += ids.filter((id) => !found.has(id)).length;
  }

  console.log(
    `Done. With photo: ${withImage}, initials only: ${initialsOnly}, not found in Clerk: ${missingInClerk}`,
  );
  process.exit(0);
};

run();