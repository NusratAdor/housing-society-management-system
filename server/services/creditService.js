// server/services/creditService.js
//
// Advance payment / credit balance system.
//
// Design principle: the credit balance is NEVER stored as a mutable
// number — always derived from Payment.advanceAmount and
// PaymentAllocation records.
//
// A monthly charge's credit application is all-or-nothing: if a
// member's available credit fully covers a newly-created charge, it's
// applied and the charge is marked Paid. If it doesn't fully cover the
// charge (most commonly because the monthly fee changed after the
// member prepaid), NOTHING is applied — the charge stays Unpaid, the
// credit stays banked untouched, and the member is notified so the
// office can manually reconcile the difference via a separate
// ExtraCharge with a clear reason. This is a deliberate business rule,
// not a limitation — the office wants to see and control any fee-
// change adjustment rather than have the system quietly settle it.
//
// Wrapped in runInTransactionWithRetry, which delegates to Mongoose's
// session.withTransaction() — this correctly handles both a transient
// transaction conflict (retries the whole transaction) and an unknown
// commit result (retries only the commit), rather than a hand-rolled
// retry loop that can't safely distinguish the two.
//
// creditVersion is a transaction-serialization point, NOT an
// optimistic-lock version check — its only job is to give two
// concurrent credit applications for the same member a shared
// document to write to, so MongoDB's transaction conflict detection
// has something real to catch; the loser is retried automatically.

import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";

// ─── getAvailableCreditDeposits ─────────────────────────────────────────────
// Returns the member's completed payments that still have unapplied
// credit, oldest first (FIFO), each annotated with how much of its
// advanceAmount remains available to draw from.

const getAvailableCreditDeposits = async (memberId, session = null) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const depositQuery = Payment.find({
    member: memberObjectId,
    advanceAmount: { $gt: 0 },
    status: "completed",
  })
    .sort({ paidAt: 1 })
    .select("amount advanceAmount paidAt");
  if (session) depositQuery.session(session);
  const deposits = await depositQuery.lean();

  if (deposits.length === 0) return [];

  const depositIds = deposits.map((d) => d._id);

  const allocationTotalsAgg = PaymentAllocation.aggregate([
    { $match: { payment: { $in: depositIds } } },
    { $group: { _id: "$payment", total: { $sum: "$amount" } } },
  ]);
  if (session) allocationTotalsAgg.session(session);
  const allocationTotals = await allocationTotalsAgg;

  const allocatedByPayment = Object.fromEntries(
    allocationTotals.map((a) => [String(a._id), a.total]),
  );

  return deposits
    .map((deposit) => {
      const chargesPortion = deposit.amount - deposit.advanceAmount;
      const totalAllocated = allocatedByPayment[String(deposit._id)] || 0;
      const appliedFromCredit = Math.max(0, totalAllocated - chargesPortion);
      const remaining = deposit.advanceAmount - appliedFromCredit;
      return { paymentId: deposit._id, remaining };
    })
    .filter((d) => d.remaining > 0);
};

// ─── getMemberCreditBalance ───────────────────────────────────────────────

export const getMemberCreditBalance = async (memberId) => {
  const deposits = await getAvailableCreditDeposits(memberId);
  return deposits.reduce((sum, d) => sum + d.remaining, 0);
};

// ─── applyCreditToMonthlyCharge ───────────────────────────────────────────
// Called right after a new MonthlyCharge is created (chargeService.js),
// for any member who has an available credit balance. Draws from the
// member's oldest unapplied deposits first (FIFO).
//
// All-or-nothing: a MonthlyCharge is only ever fully cleared here,
// never partially. If total available credit is less than the charge
// amount, nothing is applied; the credit stays banked, and the member
// is notified of the shortfall so the office can create a manual
// ExtraCharge adjustment if needed.
//
// Returns true if the charge was fully cleared by credit, false otherwise.

export const applyCreditToMonthlyCharge = async (memberId, chargeId) => {
  const outcome = await runInTransactionWithRetry(async (session) => {
    // Concurrency guard — see file header.
    await Member.updateOne(
      { _id: memberId },
      { $inc: { creditVersion: 1 } },
      { session },
    );

    const charge = await MonthlyCharge.findById(chargeId).session(session);

    if (!charge || charge.status !== "Unpaid") {
      return { applied: false };
    }

    const deposits = await getAvailableCreditDeposits(memberId, session);
    const totalAvailable = deposits.reduce((sum, d) => sum + d.remaining, 0);

    if (totalAvailable < charge.amount) {
      // Not enough credit to fully cover this charge — apply nothing.
      return {
        applied: false,
        shortfall: totalAvailable > 0,
        available: totalAvailable,
        chargeAmount: charge.amount,
      };
    }

    let remainingToCover = charge.amount;
    const allocationDocs = [];
    const now = new Date();

    for (const deposit of deposits) {
      if (remainingToCover <= 0) break;
      const amountFromThisDeposit = Math.min(
        deposit.remaining,
        remainingToCover,
      );

      allocationDocs.push({
        payment: deposit.paymentId,
        member: charge.member,
        chargeType: "monthly",
        chargeId: charge._id,
        amount: amountFromThisDeposit,
        allocatedAt: now,
      });

      remainingToCover -= amountFromThisDeposit;
    }

    await PaymentAllocation.insertMany(allocationDocs, {
      session,
      ordered: true,
    });

    charge.status = "Paid";
    charge.paidAt = now;
    await charge.save({ session });

    return { applied: true };
  });

  // ── Notification — sent AFTER successful commit only, never inside
  // the transaction. Informs the office that a member's prepaid
  // credit didn't fully cover a month, so they know to check whether
  // a manual fee-adjustment ExtraCharge is needed. This is purely
  // informational — no money moves, no charge status changes.
  if (!outcome.applied && outcome.shortfall) {
    try {
      const member = await Member.findById(memberId)
        .select("clerkUserId name")
        .lean();
      if (member?.clerkUserId) {
        await Notification.create({
          type: "Payment",
          content:
            `Your prepaid credit (৳${outcome.available.toLocaleString()}) does not fully ` +
            `cover this month's due of ৳${outcome.chargeAmount.toLocaleString()}. ` +
            `Your credit is safe and unchanged. Add ৳${(outcome.chargeAmount - outcome.available).toLocaleString()} ` +
            `from the Payment page and it will be applied automatically once confirmed.`,
          clerkUserId: member.clerkUserId,
          adminOnly: false,
        });
      }
    } catch (notifErr) {
      console.error(
        `[CreditService] Shortfall notification failed for member ${memberId}:`,
        notifErr.message,
      );
    }
  }

  return outcome.applied;
};

// ─── reconcileMemberCredit ───────────────────────────────────────────────
// Re-attempts credit application for a member's outstanding monthly
// charges, oldest first. Called both when a new MonthlyCharge is
// created AND whenever a member's advance credit grows (a new advance
// payment is confirmed) — so a shortfall that couldn't be covered on
// day 1 is automatically retried and resolved the moment enough
// credit exists, with no admin action needed.
//
// Oldest-first, all-or-nothing — same FIFO principle used everywhere
// else in this system. If the oldest outstanding charge can't be
// fully covered, reconciliation stops there; a later, smaller charge
// is never paid ahead of an older one still waiting on its own credit.
//
// Returns the list of MonthlyCharge _ids that were newly cleared.

export const reconcileMemberCredit = async (memberId) => {
  const outstandingCharges = await MonthlyCharge.find({
    member: memberId,
    status: "Unpaid",
  })
    .sort({ year: 1, month: 1 })
    .select("_id")
    .lean();

  const cleared = [];

  for (const charge of outstandingCharges) {
    const applied = await applyCreditToMonthlyCharge(memberId, charge._id);
    if (!applied) break; // oldest-first: stop at the first one credit can't fully cover
    cleared.push(charge._id);
  }

  return cleared;
};
