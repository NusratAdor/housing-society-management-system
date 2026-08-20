// server/services/feeService.js
//
// Pure functions for fee lookups. No req/res knowledge.
// Imported by: paymentService, settingsController, paymentJobs.
//
// Having this in a dedicated service file means:
//   - paymentService can call getFeeForMonth() without importing
//     from settingsController (avoids circular dependencies)
//   - The fee lookup logic exists in exactly one place
//   - Easy to unit-test independently

import FeeHistory from "../models/FeeHistory.js";



// ─── getFeeForMonth ───────────────────────────────────────────────────────────
// Returns the fee amount (in BDT) that was active for a given month and year.
//
// Algorithm:
//   Find the FeeHistory record with the highest effectiveFrom date that is
//   on or before the first day of the target month.
//
// Example:
//   FeeHistory records: [{ amount: 500, effectiveFrom: 2025-01-01 },
//                        { amount: 600, effectiveFrom: 2025-04-01 }]
//
//   getFeeForMonth(1, 2025) → 500  (Jan: only the 500 record applies)
//   getFeeForMonth(3, 2025) → 500  (Mar: 600 not yet effective)
//   getFeeForMonth(4, 2025) → 600  (Apr: 600 record now effective)
//   getFeeForMonth(7, 2025) → 600  (Jul: 600 still the latest)
//
// This is called by:
//   - createMonthlyChargesForMonth() to lock the amount at charge creation
//   - getMemberDueBreakdown() to show the current fee on the dashboard

export const getFeeForMonth = async (month, year) => {
  // First day of the target month at midnight UTC
  // Using UTC month constructor: Date.UTC(year, monthIndex, day)
  // month is 1-based so monthIndex = month - 1
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));

  const record = await FeeHistory
    .findOne({ effectiveFrom: { $lte: firstDayOfMonth } })
    .sort({ effectiveFrom: -1 })   // get the most recent one on or before target
    .lean();

  if (!record) {
    // No fee configured for this month. This must never silently
    // default — MonthlyCharge.amount is locked permanently at
    // creation, so a guessed number here becomes a permanent,
    // financially-incorrect record with no built-in way to correct it.
    // Fail loud instead: abort charge creation and surface a clear,
    // actionable error to whoever triggered this (cron log, or the
    // member-registration flow, which logs and continues without
    // creating the charge — see memberController.js).
    throw new Error(
      `No fee configured for ${month}/${year}. Run scripts/seedInitialFee.js or set a fee covering this month before generating charges.`
    );
  }

  return record.amount;
};

// ─── getCurrentFee ────────────────────────────────────────────────────────────
// Returns the fee currently in effect — for display on dashboards and
// for creating charges for the current month.
//
// Equivalent to getFeeForMonth(currentMonth, currentYear) but reads
// the latest record directly without needing a target date.

export const getCurrentFee = async () => {
  const record = await FeeHistory
    .findOne()
    .sort({ effectiveFrom: -1 })
    .lean();

    
  if (!record) {
    throw new Error(
      "No fee has been configured yet. Run scripts/seedInitialFee.js before opening the site to members."
    );
  }

  return record.amount;
};

// ─── getFeeHistory ────────────────────────────────────────────────────────────
// Returns the full fee change history for the admin audit view.
// Most recent change first.

export const getFeeHistory = async () => {
  return FeeHistory
    .find()
    .sort({ effectiveFrom: -1 })
    .lean();
};

// ─── createFeeRecord ─────────────────────────────────────────────────────────
// Creates a new FeeHistory record.
// Called by settingsController — business logic lives here, not in controller.
//
// effectFromNext: true  → fee takes effect from the 1st of NEXT month (default)
//                false  → fee takes effect from the 1st of CURRENT month
//
// Why next month is the default:
//   If admin changes the fee on March 15th, members who already paid March
//   at 500 should not suddenly owe 100 more. The new fee takes effect
//   from April 1st so everyone has fair notice.
//
//   Exception: admin can override to "current month" when setting the fee
//   for the first time, or when correcting an error in the same month.

export const createFeeRecord = async ({
  amount,
  reason,
  createdBy,
  effectFromNext = true,
}) => {
  const now = new Date();

  let effectiveFrom;
  if (effectFromNext) {
    // First day of next month at midnight UTC
    effectiveFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else {
    // First day of current month at midnight UTC
    effectiveFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  // Check if a record already exists for this effective date
  // (prevents duplicate effective dates which would make fee lookup ambiguous)
  const existing = await FeeHistory.findOne({ effectiveFrom });
  if (existing) {
    // Update the existing record for this month rather than creating a duplicate
    // This handles the case where admin sets the fee twice in the same month
    existing.amount    = amount;
    existing.createdBy = createdBy;
    existing.reason    = reason || "";
    await existing.save();
    return existing;
  }

  const record = await FeeHistory.create({
    amount,
    effectiveFrom,
    createdBy,
    reason: reason || "",
  });

  return record;
};