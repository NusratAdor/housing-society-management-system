// server/services/memberSeatService.js
//
// Backdated due generation for newly registered members.
//
// When a member claims a seat, this service creates MonthlyCharge records
// for every month from their joinDate up to (but not including) the current
// month. The current month is handled by the normal monthly cron job.
//
// Each historical charge uses the fee that was active during that specific
// month — getFeeForMonth() from feeService.js handles this correctly.
//
// Design: idempotent. If called twice (e.g. retry after a partial failure),
// existing charges are detected and skipped. No duplicates are created.

import MonthlyCharge from "../models/MonthlyCharge.js";
import { getFeeForMonth } from "./feeService.js";

// ─── generateBackdatedCharges ─────────────────────────────────────────────────
// Creates MonthlyCharge records from joinDate to last month inclusive.
//
// Parameters:
//   memberId  — MongoDB ObjectId of the newly created Member document
//   joinDate  — Date object from MemberSeat.joinDate
//
// Returns:
//   { created, skipped } — how many charges were created vs already existed

export const generateBackdatedCharges = async ({ memberId, joinDate }) => {
  const now = new Date();

  // We generate charges up to and including LAST month.
  // Current month is left to the monthly cron job so it runs
  // for all members consistently on the 1st.
  const endYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const endMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-based

  // Build the list of (month, year) pairs to generate charges for
  const periods = [];
  const start   = new Date(joinDate);

  // Normalise to first of month so month arithmetic is clean
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end  = new Date(Date.UTC(endYear, endMonth - 1, 1)); // last month, first day

  while (cursor <= end) {
    periods.push({
      month: cursor.getUTCMonth() + 1, // 1-based
      year:  cursor.getUTCFullYear(),
    });
    // Advance one month
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  if (periods.length === 0) {
    // joinDate is in the current month or the future — nothing to backdate
    return { created: 0, skipped: 0 };
  }

  // Check which charges already exist for this member (idempotency guard)
  const existing = await MonthlyCharge.find({
    member: memberId,
    $or: periods.map(p => ({ month: p.month, year: p.year })),
  }).select("month year").lean();

  const existingSet = new Set(existing.map(c => `${c.year}-${c.month}`));

  // Build charge documents for periods that do not already exist
  // Fetch fees in parallel for all needed periods
  const periodsToCreate = periods.filter(
    p => !existingSet.has(`${p.year}-${p.month}`)
  );

  if (periodsToCreate.length === 0) {
    return { created: 0, skipped: periods.length };
  }

  // Fetch the correct fee for each period — parallel for speed
  const chargesWithFees = await Promise.all(
    periodsToCreate.map(async ({ month, year }) => {
      const amount = await getFeeForMonth(month, year);
      return { member: memberId, month, year, amount, status: "Unpaid" };
    })
  );

  // Bulk insert — ordered:false so partial failures do not block the rest
  const inserted = await MonthlyCharge.insertMany(
    chargesWithFees,
    { ordered: false }
  );

  return {
    created: inserted.length,
    skipped: periods.length - periodsToCreate.length,
  };
};