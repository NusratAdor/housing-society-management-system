// models/MonthlyDue.js
// WHY this model exists instead of reusing Payment:
//   The current system confusingly stores BOTH "this member owes money
//   for March" AND "this member paid money" in the same Payment collection,
//   distinguished only by method="Manual" vs method="Gateway". That means
//   admin approval queues leak internal tracking records, and the member's
//   transaction history is polluted with cron-generated entries.
//
//   Professional systems separate the CHARGE (obligation/debit) from the
//   PAYMENT (settlement/credit). Here:
//     MonthlyDue = "member owes 500 for January 2025" (debit record)
//     Payment    = "member paid 1000 on Jan 15 2025"  (credit record)
//     PaymentAllocation = "that 1000 covered Jan + Feb"
//
//   Due = SUM(MonthlyDue.feeAmount where status=Unpaid)
//         + SUM(Charge.amount where status=Unpaid)
//         - (always zero if we update status to Paid on allocation)
//   This is a simplified ledger that is easy to query and correct.
//
// HOW it links:
//   - paymentJobs.js cron: creates one MonthlyDue per member on 1st of month
//   - paymentController.paymentCallback: after successful payment, marks
//     MonthlyDues as Paid via PaymentAllocation
//   - paymentController.getMemberDueBreakdown: queries MonthlyDues to build
//     the ordered list of unpaid months shown in the UI checkboxes
//   - recalculateDue: SUM of unpaid MonthlyDue.feeAmount for this member

import mongoose from "mongoose";

const monthlyDueSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
    },
    // Fee amount LOCKED at creation time — never changes even if admin
    // updates the monthly fee later. Historical financial integrity.
    feeAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Unpaid", "Paid"],
      default: "Unpaid",
      index: true,
    },
    // Which Payment record settled this due
    paidViaPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index: one MonthlyDue per member per month/year
monthlyDueSchema.index({ member: 1, month: 1, year: 1 }, { unique: true });
// Query index for fetching unpaid dues for a member in chronological order
monthlyDueSchema.index({ member: 1, status: 1, year: 1, month: 1 });

export default mongoose.model("MonthlyDue", monthlyDueSchema);