// server/services/creditService.js
//
// Advance payment / credit balance system.
//
// A single payment can be split between clearing existing dues and
// banking extra as credit for future months, in one transaction — e.g.
// a member pays this month's due plus an extra ৳500 towards next month.
//
// Design principle (same as the rest of the payment system): the credit
// balance is NEVER stored as a mutable number. It is always derived from
// two already-existing collections — no new ledger model needed:
//
//   1. Completed Payments with advanceAmount > 0 — the credit portion of
//      that transaction, fixed at the moment the payment was created.
//   2. PaymentAllocation records referencing those same payments —
//      created either immediately (for the charges portion of that same
//      payment) or later (when banked credit is auto-applied to a
//      newly-created MonthlyCharge).
//
// For a given deposit payment P:
//   chargesPortion(P)    = P.amount - P.advanceAmount   (fixed, known)
//   totalAllocated(P)    = SUM(PaymentAllocation.amount where payment=P)
//   appliedFromCredit(P) = totalAllocated(P) - chargesPortion(P)
//   remainingCredit(P)   = P.advanceAmount - appliedFromCredit(P)
//
// This works because every PaymentAllocation against P is real money
// from P clearing a real charge — whether that happened the moment P was
// confirmed, or months later when P's banked credit was drawn down for a
// new due. PaymentAllocation's existing meaning never changes, and
// nothing in transaction-history rendering needs to special-case this.

import mongoose          from "mongoose";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import MonthlyCharge     from "../models/MonthlyCharge.js";

// ─── getAvailableCreditDeposits ───────────────────────────────────────────────
// Returns the member's completed payments that still have unapplied
// credit, oldest first (FIFO), each annotated with how much of its
// advanceAmount remains available to draw from.

const getAvailableCreditDeposits = async (memberId, session = null) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const depositQuery = Payment
    .find({ member: memberObjectId, advanceAmount: { $gt: 0 }, status: "completed" })
    .sort({ paidAt: 1 })
    .select("amount advanceAmount paidAt");
  if (session) depositQuery.session(session);
  const deposits = await depositQuery.lean();

  if (deposits.length === 0) return [];

  const depositIds = deposits.map(d => d._id);

  const allocationTotalsAgg = PaymentAllocation.aggregate([
    { $match: { payment: { $in: depositIds } } },
    { $group: { _id: "$payment", total: { $sum: "$amount" } } },
  ]);
  if (session) allocationTotalsAgg.session(session);
  const allocationTotals = await allocationTotalsAgg;

  const allocatedByPayment = Object.fromEntries(
    allocationTotals.map(a => [String(a._id), a.total])
  );

  return deposits
    .map(deposit => {
      const chargesPortion    = deposit.amount - deposit.advanceAmount;
      const totalAllocated    = allocatedByPayment[String(deposit._id)] || 0;
      const appliedFromCredit = Math.max(0, totalAllocated - chargesPortion);
      const remaining         = deposit.advanceAmount - appliedFromCredit;
      return { paymentId: deposit._id, remaining };
    })
    .filter(d => d.remaining > 0);
};

// ─── getMemberCreditBalance ───────────────────────────────────────────────────
// Total unapplied advance-payment credit for a member. Surfaced on the
// member dashboard as "Credit Balance: ৳X".

export const getMemberCreditBalance = async (memberId) => {
  const deposits = await getAvailableCreditDeposits(memberId);
  return deposits.reduce((sum, d) => sum + d.remaining, 0);
};

// ─── applyCreditToMonthlyCharge ───────────────────────────────────────────────
// Called right after a new MonthlyCharge is created (chargeService.js),
// for any member who has an available credit balance. Draws from the
// member's oldest unapplied deposits first (FIFO).
//
// A MonthlyCharge is only ever fully cleared here, never partially —
// consistent with its existing schema, which has no partial-payment
// concept. If total available credit is less than the charge amount,
// nothing is applied; the credit stays banked for a future, smaller
// charge, and the new charge is simply left as a normal unpaid due.
//
// Runs its own transaction so the MonthlyCharge update and the
// PaymentAllocation record(s) it creates commit or roll back together.
//
// Returns true if the charge was fully cleared by credit, false otherwise.

export const applyCreditToMonthlyCharge = async (memberId, chargeId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const charge = await MonthlyCharge.findById(chargeId).session(session);

    if (!charge || charge.status !== "Unpaid") {
      await session.commitTransaction();
      return false;
    }

    const deposits       = await getAvailableCreditDeposits(memberId, session);
    const totalAvailable = deposits.reduce((sum, d) => sum + d.remaining, 0);

    if (totalAvailable < charge.amount) {
      await session.commitTransaction();
      return false;
    }

    let remainingToCover = charge.amount;
    const allocationDocs = [];
    const now = new Date();

    for (const deposit of deposits) {
      if (remainingToCover <= 0) break;
      const amountFromThisDeposit = Math.min(deposit.remaining, remainingToCover);

      allocationDocs.push({
        payment:     deposit.paymentId,
        member:      charge.member,
        chargeType:  "monthly",
        chargeId:    charge._id,
        amount:      amountFromThisDeposit,
        allocatedAt: now,
      });

      remainingToCover -= amountFromThisDeposit;
    }

    await PaymentAllocation.insertMany(allocationDocs, { session, ordered: true });

    charge.status = "Paid";
    charge.paidAt = now;
    // clearedByPayment intentionally left unset — this charge may be
    // cleared by more than one prior deposit payment, so no single
    // Payment _id correctly represents it. The PaymentAllocation records
    // above are the authoritative source for "what cleared this."
    await charge.save({ session });

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};