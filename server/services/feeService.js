// server/services/feeService.js
//
// Fee lookups and prepay planning. No req/res knowledge.
//
// CHANGE (this pass):
//   - getPrepayPlan(): prices EACH future month from FeeHistory (the dropdown
//     used today's fee for every month), walks existing credit month by month,
//     and returns the capacity used by the backend validation.
//   - createFeeRecord() can run inside the caller's transaction (session).
//   - getCurrentFee() uses the Dhaka business month; getFeesForMonths() does
//     one query for many months.

import FeeHistory from "../models/FeeHistory.js";
import { getDhakaDateParts } from "../utils/dateTime.js";
import { MAX_PREPAY_MONTHS } from "../configs/paymentConfig.js";

const noFeeError = (month, year) =>
  new Error(
    `No fee configured for ${month}/${year}. ` +
      `Run scripts/seedInitialFee.js or set a fee covering this month before generating charges.`,
  );

// ─── getFeeForMonth ───────────────────────────────────────────────────────────

export const getFeeForMonth = async (month, year, session = null) => {
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));

  const query = FeeHistory.findOne({
    effectiveFrom: { $lte: firstDayOfMonth },
  }).sort({ effectiveFrom: -1 });

  if (session) query.session(session);

  const record = await query.lean();
  if (!record) throw noFeeError(month, year);

  return record.amount;
};

// ─── getFeesForMonths ─────────────────────────────────────────────────────────
// ONE query for many months; matched in memory. Returns [{ month, year, amount }].

export const getFeesForMonths = async (periods, session = null) => {
  if (periods.length === 0) return [];

  const query = FeeHistory.find({})
    .sort({ effectiveFrom: 1 })
    .select("amount effectiveFrom");

  if (session) query.session(session);

  const records = await query.lean();

  return periods.map(({ month, year }) => {
    const monthStart = Date.UTC(year, month - 1, 1);

    let match = null;
    for (const record of records) {
      if (record.effectiveFrom.getTime() <= monthStart) match = record;
      else break;
    }

    if (!match) throw noFeeError(month, year);
    return { month, year, amount: match.amount };
  });
};

// ─── getCurrentFee ────────────────────────────────────────────────────────────
// Fee of the current Dhaka business month.

export const getCurrentFee = async () => {
  const { month, year } = getDhakaDateParts();
  return getFeeForMonth(month, year);
};

// ─── getFeeHistory ────────────────────────────────────────────────────────────

export const getFeeHistory = async () => {
  return FeeHistory.find().sort({ effectiveFrom: -1 }).lean();
};

// ─── getPrepayPlan ────────────────────────────────────────────────────────────
// What a member can prepay, priced at each month's real FeeHistory fee.
//
//   newestCharge  { month, year } of the member's newest MonthlyCharge, or null
//   creditBalance current available credit
//
// Example: credit ৳300; Oct fee ৳400, Nov ৳400:
//   Oct not covered (300 < 400); leftover 300
//   option "through Oct" costs 400 − 300 = ৳100
//   option "through Nov" costs 800 − 300 = ৳500
//
// Returns { fees, capacity, options: [{ month, year, fee, cost }], coveredThrough }

const monthIndex = ({ month, year }) => year * 12 + (month - 1);

const shiftMonth = ({ month, year }, n) => {
  const idx = monthIndex({ month, year }) + n;
  return { month: (idx % 12) + 1, year: Math.floor(idx / 12) };
};

export const getPrepayPlan = async ({ newestCharge = null, creditBalance = 0 }) => {
  const { year, month } = getDhakaDateParts();
  const current = { month, year };

  // First month not billed yet: the month after the newest charge, never
  // earlier than the current Dhaka month.
  const afterNewest = newestCharge ? shiftMonth(newestCharge, 1) : current;
  const firstUnbilled =
    monthIndex(afterNewest) >= monthIndex(current) ? afterNewest : current;

  const periods = Array.from({ length: MAX_PREPAY_MONTHS }, (_, i) =>
    shiftMonth(firstUnbilled, i),
  );
  const fees = await getFeesForMonths(periods);

  const capacity = fees.reduce((sum, f) => sum + f.amount, 0);

  // Existing credit covers whole months, oldest first (all-or-nothing).
  let remaining = creditBalance;
  let covered = 0;
  while (covered < fees.length && remaining >= fees[covered].amount) {
    remaining -= fees[covered].amount;
    covered += 1;
  }

  let running = -remaining;
  const options = fees.slice(covered).map((f) => {
    running += f.amount;
    return { month: f.month, year: f.year, fee: f.amount, cost: running };
  });

  return {
    fees,
    capacity,
    options,
    coveredThrough:
      covered > 0
        ? { month: fees[covered - 1].month, year: fees[covered - 1].year }
        : null,
  };
};

// ─── createFeeRecord ─────────────────────────────────────────────────────────
// effectFromNext: true → effective the 1st of NEXT Dhaka month (default)
//                 false → the 1st of the CURRENT Dhaka month
// FeeHistory is append-only: a duplicate effective date is rejected.
// Pass `session` to run inside the caller's transaction.

export const createFeeRecord = async ({
  amount,
  reason,
  createdBy,
  effectFromNext = true,
  session = null,
}) => {
  const { year, month } = getDhakaDateParts();

  // Date.UTC(year, 12, 1) rolls over to January of next year.
  const monthIdx = effectFromNext ? month : month - 1;
  const effectiveFrom = new Date(Date.UTC(year, monthIdx, 1));

  const duplicateMessage = (existingAmount) =>
    `A fee change is already recorded effective ${effectiveFrom.toISOString().slice(0, 10)}` +
    (existingAmount !== undefined ? ` (৳${existingAmount})` : "") +
    `. FeeHistory is append-only. To correct a mistake, set the ` +
    `corrected amount effective next month, or make a deliberate, manually-audited ` +
    `correction directly if this one truly needs to change.`;

  const existingQuery = FeeHistory.findOne({ effectiveFrom });
  if (session) existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) throw new Error(duplicateMessage(existing.amount));

  try {
    const [record] = await FeeHistory.create(
      [{ amount, effectiveFrom, createdBy, reason: reason || "" }],
      session ? { session } : undefined,
    );
    return record;
  } catch (error) {
    if (error?.code === 11000) throw new Error(duplicateMessage());
    throw error;
  }
};