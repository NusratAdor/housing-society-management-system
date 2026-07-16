// server/models/MonthlyCharge.js
//
// One record per member per calendar month.
// Created by the cron job on the 1st of each month.
//
// The amount field is locked at creation time from FeeHistory.
// It NEVER changes, even if the admin later updates the monthly fee.
// This is what makes historical dues financially accurate.
//
// Design decision — why store status here if due is computed:
//   We cache status ("Unpaid"/"Paid") on the charge itself after
//   PaymentAllocation is created. This lets us query
//   "all unpaid charges for member X" without joining PaymentAllocation.
//   The status is always updated atomically alongside the allocation
//   inside a MongoDB transaction — it can never drift out of sync.
//
// CHANGE (this pass) — supporting the Opening Balance charge created in
// memberController.js:
//   1. `month`/`year` were `min: 1/max: 12` and `min: 2020` — both reject
//      the `(0, 0)` sentinel pair the opening-balance charge uses. Rather
//      than just loosening the bounds (e.g. min: 0), which would also
//      accept nonsensical combinations like month: 0, year: 2024,
//      switched both to a `validate` function that accepts EITHER a real
//      month/year pair OR the exact (0, 0) sentinel. Regular cron-created
//      charges (real month 1-12, real year >= 2020) validate identically
//      to before — this only opens the door for the one specific sentinel
//      case, nothing broader.
//   2. Added `label` (optional string, default null). It didn't exist on
//      this schema before, which means `label: "Opening Balance"` from
//      the controller was being silently stripped on save (Mongoose's
//      default strict mode drops fields not defined in the schema) — so
//      the controller's `findOne({ member, label: "Opening Balance" })`
//      idempotency check could never actually find a match. Regular
//      charges never set this field, so it just stays null for them,
//      identical to their current behavior.
//   3. Everything else — amount, status, paidAt, clearedByPayment, both
//      existing indexes, timestamps — UNCHANGED. The existing unique
//      index on {member, month, year} already gives the opening-balance
//      charge a DB-level duplicate guard too, since (0, 0) can only occur
//      once per member regardless of the label check.

import mongoose from "mongoose";

const monthlyChargeSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    // 1–12 for a real monthly charge, OR 0 as the Opening Balance sentinel
    // (paired with year: 0 below — see the validator for both fields).
    month: {
      type:     Number,
      required: true,
      validate: {
        validator: (v) => v === 0 || (v >= 1 && v <= 12),
        message:   "Month must be 0 (opening balance sentinel) or between 1 and 12",
      },
    },

    // A real year for a real monthly charge, OR 0 as the Opening Balance
    // sentinel (paired with month: 0 above).
    year: {
      type:     Number,
      required: true,
      validate: {
        validator: (v) => v === 0 || v >= 2020,
        message:   "Year must be 0 (opening balance sentinel) or 2020 or later",
      },
    },

    // Locked at creation from FeeHistory — never changes after creation
    // (for a regular charge). For the Opening Balance charge this is
    // seat.openingBalance instead, set once at claim time.
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Charge amount must be at least 1 BDT"],
    },

    // Optional label for special, non-monthly charges (currently only
    // "Opening Balance"). Left as a free string rather than an enum so
    // future one-off charge types don't require a schema migration.
    // null/undefined for every regular cron-created monthly charge.
    label: {
      type:    String,
      default: null,
    },

    // Cached status — updated atomically inside allocatePayment transaction
    // "Unpaid" → no PaymentAllocation covers this charge yet
    // "Paid"   → a PaymentAllocation fully covers this charge
    status: {
      type:    String,
      enum:    ["Unpaid", "Paid"],
      default: "Unpaid",
    },

    // Set when status transitions to "Paid" — for display in history
    paidAt: {
      type: Date,
    },

    // Reference to the Payment that cleared this charge
    // Set when status transitions to "Paid"
    clearedByPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Payment",
    },
  },
  {
    timestamps: true,
  }
);

// UNIQUE constraint: one charge per member per month/year combination
// Prevents the cron job from creating duplicate charges if it runs twice.
// Also doubles as the DB-level guard against a duplicate Opening Balance
// charge, since (member, 0, 0) can only exist once per member.
monthlyChargeSchema.index(
  { member: 1, month: 1, year: 1 },
  { unique: true }
);

// Most common query: all unpaid charges for a member (for due calculation)
monthlyChargeSchema.index({ member: 1, status: 1 });

// For the 12-month history display — sorted by year/month
monthlyChargeSchema.index({ member: 1, year: -1, month: -1 });

export default mongoose.model("MonthlyCharge", monthlyChargeSchema);