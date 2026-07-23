// server/services/creditService.js
//
// Advance payment / credit balance system.
//
// Design principle (same as the rest of the payment system): the credit
// balance is NEVER stored as a mutable number. It is always computed from
// two already-existing, immutable sources of truth:
//
//   1. Completed "credit deposit" Payments — Payment.isCreditDeposit=true,
//      status="completed". Money the member paid in that wasn't tied to
//      any charge that existed yet.
//   2. PaymentAllocation records against those same deposit payments —
//      created later, whenever that credit is applied to clear a
//      newly-created MonthlyCharge.
//
//   creditBalance = SUM(deposit payment amounts) - SUM(allocations against those payments)
//
// A deposit is never "spent" until it clears a real, dated charge — at
// which point it becomes an ordinary, fully-audited PaymentAllocation
// record, identical in shape to any other payment allocation. This means
// an advance payment automatically appears correctly in the member's
// existing transaction history and receipt breakdowns with NO changes
// needed to that code.

import mongoose          from "mongoose";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import { generateReceiptNumber } from "./allocationService.js";

// ─── getAvailableCreditDeposits ───────────────────────────────────────────────
// Returns the member's completed credit-deposit payments, oldest first,
// each annotated with how much is still unapplied. Used both to compute
// the total credit balance and, in FIFO order, to decide which deposit(s)
// to draw from when applying credit to a charge.

const getAvailableCreditDeposits = async (memberId, session = null) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const depositQuery = Payment
    .find({ member: memberObjectId, isCreditDeposit: true, status: "completed" })
    .sort({ paidAt: 1 });
  if (session) depositQuery.session(session);
  const deposits = await depositQuery.lean();

  if (deposits.length === 0) return [];

  const depositIds = deposits.map(d => d._id);

  const allocQuery = PaymentAllocation.find({ payment: { $in: depositIds } });
  if (session) allocQuery.session(session);
  const allocations = await allocQuery.lean();

  const appliedByPayment = {};
  for (const alloc of allocations) {
    const pid = String(alloc.payment);
    appliedByPayment[pid] = (appliedByPayment[pid] || 0) + alloc.amount;
  }

  return deposits
    .map(deposit => ({
      paymentId: deposit._id,
      remaining: deposit.amount - (appliedByPayment[String(deposit._id)] || 0),
    }))
    .filter(d => d.remaining > 0);
};

// ─── getMemberCreditBalance ───────────────────────────────────────────────────
// Total unapplied credit for a member. Used by the dashboard to show
// "Credit Balance: ৳X" and to decide whether an advance payment is
// currently permitted.

export const getMemberCreditBalance = async (memberId) => {
  const deposits = await getAvailableCreditDeposits(memberId);
  return deposits.reduce((sum, d) => sum + d.remaining, 0);
};

// ─── validateAdvancePaymentRequest ────────────────────────────────────────────
// Validates a member's request to make an advance payment.
//
// Business rule: advance payment is only permitted when the member has
// zero current outstanding dues. This keeps the semantics unambiguous —
// there is never a question of "does this money go to my current due or
// to credit?" It always means credit, because there is nothing else it
// could mean once this check passes.

export const validateAdvancePaymentRequest = ({ advanceAmount, currentTotalDue }) => {
  const amount = Number(advanceAmount);

  if (!Number.isFinite(amount) || amount < 1) {
    throw new Error("Advance payment amount must be at least 1 BDT");
  }

  if (currentTotalDue > 0) {
    throw new Error(
      "Please clear your existing dues before making an advance payment"
    );
  }

  return { amount: Math.round(amount) };
};

// ─── recordCreditDeposit ──────────────────────────────────────────────────────
// Called by adminPaymentController.approvePayment when a gateway-verified
// payment is a credit deposit rather than a payment against specific
// selected charges. There is nothing to allocate yet — the money simply
// becomes available credit. Only the Payment record itself is finalised
// here, inside a transaction, mirroring the same commit/rollback
// guarantee allocatePayment() provides for ordinary payments.

export const recordCreditDeposit = async (paymentId) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
  const now             = new Date();
  const session         = await mongoose.startSession();

  try {
    session.startTransaction();

    const payment = await Payment.findById(paymentObjectId).session(session);

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.status === "completed") {
      // Idempotent — already recorded (e.g. duplicate confirm click)
      await session.commitTransaction();
      return { receiptNumber: payment.receiptNumber };
    }

    if (payment.status !== "verified") {
      throw new Error(
        `Payment ${paymentId} has status "${payment.status}" — only gateway-verified payments can be confirmed`
      );
    }

    if (!payment.isCreditDeposit) {
      throw new Error(
        `Payment ${paymentId} is not a credit deposit — use allocatePayment instead`
      );
    }

    const receiptNumber = await generateReceiptNumber(session);

    payment.status        = "completed";
    payment.paidAt        = now;
    payment.receiptNumber = receiptNumber;
    await payment.save({ session });

    await session.commitTransaction();
    return { receiptNumber };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ─── applyCreditToMonthlyCharge ───────────────────────────────────────────────
// Called right after a new MonthlyCharge is created (chargeService.js),
// for a member who has an available credit balance. Draws from the
// member's oldest unapplied deposits first (FIFO).
//
// A MonthlyCharge is only ever fully cleared here, never partially —
// consistent with its existing schema, which has no partial-payment
// concept. If total available credit is less than the charge amount,
// nothing is applied automatically; it remains banked as credit, and the
// new charge is simply left as a normal unpaid due.
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
      // Not enough credit to fully clear this charge — leave it unpaid;
      // existing credit stays banked for a future, smaller charge.
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
    // clearedByPayment intentionally left unset — this charge was cleared
    // by one or more prior deposit payments, not a single payment, so no
    // one Payment _id correctly represents it. The PaymentAllocation
    // records above are the authoritative source for "what cleared this."
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