// server/services/chargeService.js
//
// Core business logic for creating and querying MonthlyCharge records.
// No req/res knowledge — pure functions called by controllers and cron jobs.
//
// Why this lives in a service and not a controller:
//   The cron job and the admin manual trigger both need createMonthlyChargesForMonth().
//   If this lived in a controller, the cron job would have to import from a controller
//   which is an architectural violation (controllers depend on services, never the reverse).
//   One service function, two callers — no duplication.

import mongoose        from "mongoose";
import Member          from "../models/Member.js";
import MonthlyCharge   from "../models/MonthlyCharge.js";
import AuditLog        from "../models/AuditLog.js";
import { getFeeForMonth } from "./feeService.js";

// ─── createMonthlyChargesForMonth ─────────────────────────────────────────────
// Creates one MonthlyCharge per member for the given month/year,
// with the amount locked from FeeHistory at the moment of creation.
//
// Design decisions:
//   1. Batch existence check first — one query instead of N findOne calls
//      (avoids the N+1 problem for 500 members)
//   2. insertMany with ordered:false — if one document fails the unique
//      constraint (somehow called twice), the rest still insert
//   3. Returns a result object so the caller can log what happened
//
// Idempotent: calling this twice for the same month is safe.
// Members who already have a charge are skipped.
//
// Called by:
//   - paymentJobs.js cron (automatically on the 1st of each month)
//   - adminController.triggerMonthlyDue (manual trigger for testing)

export const createMonthlyChargesForMonth = async ({
  month,
  year,
  performedBy = "SYSTEM", // "SYSTEM" for cron, clerkUserId for manual trigger
}) => {
  // Step 1 — Get the fee locked to this month from FeeHistory
  // This is the amount ALL charges for this month will use.
  // It never changes after this point regardless of future fee updates.
  const fee = await getFeeForMonth(month, year);

  // Step 2 — Fetch all current members
  // We only need _id for the charge creation — no need for full documents
  const allMembers = await Member
    .find({})
    .select("_id")
    .lean();

  if (allMembers.length === 0) {
    return { created: 0, skipped: 0, fee, month, year };
  }

  const allMemberIds = allMembers.map(m => m._id);

  // Step 3 — Single batch query to find members who ALREADY have a charge
  // for this month. This avoids N individual findOne() calls.
  // For 500 members this is one DB round trip instead of 500.
  const existingCharges = await MonthlyCharge
    .find({ month, year, member: { $in: allMemberIds } })
    .select("member")
    .lean();

  const existingMemberIds = new Set(
    existingCharges.map(c => String(c.member))
  );

  // Step 4 — Filter to members who do NOT yet have a charge this month
  const membersNeedingCharge = allMemberIds.filter(
    id => !existingMemberIds.has(String(id))
  );

  const skipped = allMembers.length - membersNeedingCharge.length;

  if (membersNeedingCharge.length === 0) {
    // All members already have charges — idempotent call, nothing to do
    return { created: 0, skipped, fee, month, year };
  }

  // Step 5 — Build the charge documents
  // Using the locked fee amount for every document
  const chargeDocuments = membersNeedingCharge.map(memberId => ({
    member: memberId,
    month,
    year,
    amount: fee,
    status: "Unpaid",
  }));

  // Step 6 — Bulk insert
  // ordered: false means if any individual insert fails (e.g. duplicate key
  // race condition), the remaining inserts still proceed
  const insertResult = await MonthlyCharge.insertMany(
    chargeDocuments,
    { ordered: false }
  );

  const created = insertResult.length;

  // Step 7 — Audit log
  // One audit entry for the entire batch operation
  await AuditLog.create({
    action:      "MONTHLY_DUES_ADDED",
    performedBy,
    description: `Monthly charges of ৳${fee} created for ${created} member(s) for ${month}/${year}`,
    metadata: {
      month,
      year,
      fee,
      created,
      skipped,
      totalMembers: allMembers.length,
    },
  });

  return { created, skipped, fee, month, year };
};

// ─── getMonthlyChargesForMember ───────────────────────────────────────────────
// Returns monthly charges for a member, used by the due breakdown service.
// Returns last N months in chronological order (oldest first).

export const getUnpaidMonthlyChargesForMember = async (memberId) => {
  return MonthlyCharge
    .find({
      member: new mongoose.Types.ObjectId(memberId),
      status: "Unpaid",
    })
    .sort({ year: 1, month: 1 }) // oldest first — FIFO order for payment UI
    .lean();
};

// ─── getLast12MonthlyChargesForMember ─────────────────────────────────────────
// Returns the last 12 monthly charges (paid or unpaid) for the history strip.
// Most recent first for display.

export const getLast12MonthlyChargesForMember = async (memberId) => {
  return MonthlyCharge
    .find({ member: new mongoose.Types.ObjectId(memberId) })
    .sort({ year: -1, month: -1 })
    .limit(12)
    .lean();
};