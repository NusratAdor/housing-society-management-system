// server/services/memberSeatService.js
//
// Backdated due generation for newly registered members.
//
// CHANGE (this pass): rewritten to key off MemberSeat.paidThroughMonth
// (a "YYYY-MM" string) instead of joinDate, and to generate charges
// through and INCLUDING the current month — not stopping at last month.
// A member registering mid-cycle needs the current month's charge too,
// since the monthly cron already ran for everyone else before this
// member existed in the system.
//
// Each historical charge uses the fee that was active during that
// specific month — getFeeForMonth() from feeService.js handles this
// correctly, exactly as it does for the regular monthly cron job.
//
// Design: idempotent. If called twice (e.g. retry after a partial
// failure), existing charges are detected and skipped. No duplicates
// are created — this also means it is safe to run even if the regular
// monthly cron has already created the current month's charge for this
// member by the time this runs.

import MonthlyCharge from "../models/MonthlyCharge.js";
import { getFeeForMonth } from "./feeService.js";

// ─── parsePaidThroughMonth ─────────────────────────────────────────────────
// Parses a "YYYY-MM" string into { month, year }. Returns null for an
// empty/missing value so callers can treat "no history to backfill" as
// a normal, expected case.

const parsePaidThroughMonth = (paidThroughMonth) => {
  if (!paidThroughMonth) return null;

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(paidThroughMonth);
  if (!match) return null;

  return { year: Number(match[1]), month: Number(match[2]) };
};

// ─── generateBackdatedCharges ─────────────────────────────────────────────
// Creates MonthlyCharge records from the month AFTER paidThroughMonth up
// to and including the current month.
//
// Parameters:
//   memberId          — MongoDB ObjectId of the newly created Member document
//   paidThroughMonth  — "YYYY-MM" string from MemberSeat, or null/undefined
//
// Returns:
//   { created, skipped } — how many charges were created vs already existed

export const generateBackdatedCharges = async ({ memberId, paidThroughMonth }) => {
  const paidThrough = parsePaidThroughMonth(paidThroughMonth);

  // No history to backfill — member starts fresh from their registration
  // month, handled entirely by the normal monthly cron going forward.
  if (!paidThrough) {
    return { created: 0, skipped: 0 };
  }

  const now = new Date();
  const endYear  = now.getFullYear();
  const endMonth = now.getMonth() + 1; // 1-based, inclusive of current month

  // Build the list of (month, year) pairs starting the month AFTER
  // paidThrough, through and including the current month.
  const periods = [];
  let cursor = new Date(Date.UTC(paidThrough.year, paidThrough.month, 1)); // next month, 0-based month arithmetic
  const end  = new Date(Date.UTC(endYear, endMonth - 1, 1));

  while (cursor <= end) {
    periods.push({
      month: cursor.getUTCMonth() + 1,
      year:  cursor.getUTCFullYear(),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  if (periods.length === 0) {
    // paidThroughMonth is the current month or later — nothing to backfill
    return { created: 0, skipped: 0 };
  }

  // Idempotency guard — skip any period that already has a charge
  const existing = await MonthlyCharge.find({
    member: memberId,
    $or: periods.map(p => ({ month: p.month, year: p.year })),
  }).select("month year").lean();

  const existingSet = new Set(existing.map(c => `${c.year}-${c.month}`));

  const periodsToCreate = periods.filter(
    p => !existingSet.has(`${p.year}-${p.month}`)
  );

  if (periodsToCreate.length === 0) {
    return { created: 0, skipped: periods.length };
  }

  const chargesWithFees = await Promise.all(
    periodsToCreate.map(async ({ month, year }) => {
      const amount = await getFeeForMonth(month, year);
      return { member: memberId, month, year, amount, status: "Unpaid" };
    })
  );

  const inserted = await MonthlyCharge.insertMany(
    chargesWithFees,
    { ordered: false }
  );

  return {
    created: inserted.length,
    skipped: periods.length - periodsToCreate.length,
  };
};