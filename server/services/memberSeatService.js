// server/services/memberSeatService.js
//
// Handles historical MonthlyCharge generation when a MemberSeat is claimed.
//
// MemberSeat.paidThroughMonth is a historical provisioning fact:
//   "The member had already settled dues through this month
//    before joining the digital system."
//
// This service converts that fact into real MonthlyCharge records.
//
// Important:
//   - MonthlyCharge.amount is locked from FeeHistory.
//   - FeeHistory is queried for EACH historical month.
//   - All database operations use the caller's transaction session.
//   - This service does NOT start its own transaction because the
//     member-registration flow already owns the transaction.
//
// Example:
//
//   paidThroughMonth = "2026-03"
//   current month    = "2026-10"
//
// Creates:
//
//   2026-04
//   2026-05
//   2026-06
//   2026-07
//   2026-08
//   2026-09
//   2026-10
//
// Each month's amount comes from the FeeHistory record effective
// for that specific month.

import mongoose from "mongoose";

import MonthlyCharge from "../models/MonthlyCharge.js";
import { getFeeForMonth } from "./feeService.js";
import { getDhakaDateParts } from "../utils/dateTime.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const parsePaidThroughMonth = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalized);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
};

const addOneMonth = ({ year, month }) => {
  if (month === 12) {
    return {
      year: year + 1,
      month: 1,
    };
  }

  return {
    year,
    month: month + 1,
  };
};

// ─── generateBackdatedCharges ───────────────────────────────────────────────
//
// Generates all missing MonthlyCharge records between:
//
//   paidThroughMonth + 1
//
// and:
//
//   current Dhaka month
//
// `session` is optional so the function can also be used safely in
// non-transactional contexts, although registration should always pass it.

export const generateBackdatedCharges = async ({
  memberId,
  paidThroughMonth,
  session = null,
}) => {
  const parsed = parsePaidThroughMonth(paidThroughMonth);

  if (!parsed) {
    throw new Error(
      "paidThroughMonth must be in YYYY-MM format",
    );
  }

  const { year: currentYear, month: currentMonth } =
    getDhakaDateParts();

  // Start from the month immediately after the externally-paid month.
  let cursor = addOneMonth(parsed);

  const periods = [];

  while (
    cursor.year < currentYear ||
    (cursor.year === currentYear &&
      cursor.month <= currentMonth)
  ) {
    periods.push({
      month: cursor.month,
      year: cursor.year,
    });

    cursor = addOneMonth(cursor);
  }

  // Nothing to generate when the member is already paid through
  // the current month.
  if (periods.length === 0) {
    return {
      created: 0,
      skipped: 0,
      periods: [],
    };
  }

  const memberObjectId =
    new mongoose.Types.ObjectId(memberId);

  // One query instead of one query per month.
  //
  // This is important even though the current system is only
  // ~500–550 members. It keeps the registration path predictable
  // and avoids N+1 database calls.
  const existingQuery = MonthlyCharge.find({
    member: memberObjectId,
    $or: periods.map(({ month, year }) => ({
      month,
      year,
    })),
  }).select("month year");

  if (session) {
    existingQuery.session(session);
  }

  const existingCharges = await existingQuery.lean();

  const existingKeys = new Set(
    existingCharges.map(
      (charge) => `${charge.year}-${charge.month}`,
    ),
  );

  const missingPeriods = periods.filter(
    ({ month, year }) =>
      !existingKeys.has(`${year}-${month}`),
  );

  if (missingPeriods.length === 0) {
    return {
      created: 0,
      skipped: periods.length,
      periods: [],
    };
  }

  // Historical fee lookup.
  //
  // These are independent reads, so Promise.all is appropriate.
  // Every lookup receives the same transaction session.
  const fees = await Promise.all(
    missingPeriods.map(async ({ month, year }) => {
      const amount = await getFeeForMonth(
        month,
        year,
        session,
      );

      return {
        month,
        year,
        amount,
      };
    }),
  );

  const documents = fees.map(
    ({ month, year, amount }) => ({
      member: memberObjectId,
      month,
      year,
      amount,
      status: "Unpaid",
    }),
  );

  await MonthlyCharge.insertMany(documents, {
    ordered: true,
    ...(session ? { session } : {}),
  });

  return {
    created: documents.length,
    skipped: periods.length - documents.length,
    periods: documents.map(({ month, year, amount }) => ({
      month,
      year,
      amount,
    })),
  };
};