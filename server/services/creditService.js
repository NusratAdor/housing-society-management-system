// server/services/creditService.js
//
// Advance payment / credit balance system.
//
// The credit balance is NEVER stored as a mutable number: it is derived from
// Payment.advanceAmount and PaymentAllocation records.
//
// A monthly charge is cleared by credit all-or-nothing, oldest first. If credit
// does not fully cover the oldest charge, nothing is applied and the office
// controls any fee-change difference (deliberate business rule).
//
// CHANGE (this pass):
//   - applyCreditToMonthlyCharge / reconcileMemberCredit take { notify }.
//     notify:true (cron, default): in-app notification + queued
//     "credit_applied" email.
//     notify:false (admin payment approval): the single payment confirmation
//     message/email already states what credit paid for.
//   - Notification wording lives in paymentNotificationService (idempotent).
//   - The result carries creditAfter so the message states credit remaining.
//   - Public return values are unchanged (boolean / array of charge ids).
//
// creditVersion is a transaction-serialization point, not an optimistic lock.

import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import Member from "../models/Member.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { writeAuditLog } from "./auditService.js";
import { enqueueEmail } from "./emailQueueService.js";
import {
  notifyCreditApplied,
  notifyCreditShortfall,
} from "./paymentNotificationService.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];


// A month fully covered by credit is routine: in-app notification only.
// Set to true to also email it (it counts against the daily email budget).
const EMAIL_ON_CREDIT_APPLIED = false;

// Credit left on one deposit. Shared by the per-member and the bulk reader.
const remainingCredit = (deposit, totalAllocated) => {
  const chargesPortion = deposit.amount - deposit.advanceAmount;
  const appliedFromCredit = Math.max(0, totalAllocated - chargesPortion);
  return deposit.advanceAmount - appliedFromCredit;
};


// ─── getAvailableCreditDeposits ─────────────────────────────────────────────
// Completed payments that still have unapplied credit, oldest first (FIFO).

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
        .map((deposit) => ({
      paymentId: deposit._id,
      remaining: remainingCredit(deposit, allocatedByPayment[String(deposit._id)] || 0),
    }))
    .filter((d) => d.remaining > 0);
};

// ─── getMemberCreditBalance ───────────────────────────────────────────────

export const getMemberCreditBalance = async (memberId, session = null) => {
  const deposits = await getAvailableCreditDeposits(memberId, session);
  return deposits.reduce((sum, d) => sum + d.remaining, 0);
};

// ─── applyCreditToMonthlyCharge ───────────────────────────────────────────
// Returns true if the charge was fully cleared by credit, false otherwise.

export const applyCreditToMonthlyCharge = async (
  memberId,
  chargeId,
  { notify = true } = {},
) => {
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
      return {
        applied: false,
        shortfall: totalAvailable > 0,
        available: totalAvailable,
        chargeAmount: charge.amount,
        month: charge.month,
        year: charge.year,
      };
    }

    let remainingToCover = charge.amount;
    const allocationDocs = [];
    const sourcePaymentIds = [];
    const now = new Date();

    for (const deposit of deposits) {
      if (remainingToCover <= 0) break;

      const amountFromThisDeposit = Math.min(deposit.remaining, remainingToCover);

      if (amountFromThisDeposit > 0) {
        sourcePaymentIds.push(String(deposit.paymentId));
      }

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

    await PaymentAllocation.insertMany(allocationDocs, { session, ordered: true });

    charge.status = "Paid";
    charge.paidAt = now;
    await charge.save({ session });

    await writeAuditLog({
      action: "PAYMENT_CREDIT_APPLIED",
      performedBy: "SYSTEM",
      targetId: charge._id,
      description:
        `Advance credit of ৳${charge.amount.toLocaleString()} ` +
        `applied to ${charge.month}/${charge.year} monthly charge.`,
      after: { chargeStatus: "Paid", amount: charge.amount },
      metadata: {
        memberId: String(memberId),
        month: charge.month,
        year: charge.year,
        amount: charge.amount,
        sourcePaymentIds,
      },
      session,
      required: true,
    });

    return {
      applied: true,
      month: charge.month,
      year: charge.year,
      amount: charge.amount,
      creditAfter: totalAvailable - charge.amount,
    };
  });

 // ── After commit only: notifications and email. Never inside the
  // transaction, and never able to fail a financial operation.
  if (notify && (outcome.applied || outcome.shortfall)) {
    try {
      const member = await Member.findById(memberId)
        .select("clerkUserId name email")
        .lean();

      if (member) {
        if (outcome.applied) {
          if (member.clerkUserId) {
            await notifyCreditApplied({
              clerkUserId: member.clerkUserId,
              chargeId,
              month: outcome.month,
              year: outcome.year,
              amount: outcome.amount,
              creditAfter: outcome.creditAfter,
            });
          }

          if (EMAIL_ON_CREDIT_APPLIED && member.email) {
            try {
              await enqueueEmail({
                to: member.email,
                subject: `${MONTH_NAMES[outcome.month]} ${outcome.year} fee paid from your credit`,
                type: "credit_applied",
                dedupeKey: `CREDIT_APPLIED:${chargeId}`,
                payload: {
                  name: member.name,
                  month: outcome.month,
                  year: outcome.year,
                  amount: outcome.amount,
                  creditAfter: outcome.creditAfter,
                },
              });
            } catch (queueError) {
              console.error(
                `[CreditService] credit_applied email not queued:`,
                queueError.message,
              );
            }
          }
        } else {
          if (member.clerkUserId) {
            await notifyCreditShortfall({
              clerkUserId: member.clerkUserId,
              chargeId,
              month: outcome.month,
              year: outcome.year,
              chargeAmount: outcome.chargeAmount,
              available: outcome.available,
            });
          }

          // The email has its OWN key: a failed enqueue is retried by the next
          // reconcile run (the daily sweep); a queued one is never repeated.
          if (member.email) {
            const remaining = outcome.chargeAmount - outcome.available;
            try {
              await enqueueEmail({
                to: member.email,
                subject: `Action required: ৳${remaining.toLocaleString()} remaining for ${MONTH_NAMES[outcome.month]} ${outcome.year}`,
                type: "credit_shortfall",
                dedupeKey: `CREDIT_SHORT:${chargeId}`,
                payload: {
                  name: member.name,
                  month: outcome.month,
                  year: outcome.year,
                  feeAmount: outcome.chargeAmount,
                  creditBalance: outcome.available,
                  amount: remaining,
                },
              });
            } catch (queueError) {
              console.error(
                `[CreditService] credit_shortfall email not queued:`,
                queueError.message,
              );
            }
          }
        }
      }
    } catch (notifyError) {
      console.error(
        `[CreditService] Notification step failed for member ${memberId}:`,
        notifyError.message,
      );
    }
  }

  return outcome.applied;
};

// ─── reconcileMemberCredit ───────────────────────────────────────────────
// Re-attempts credit application for outstanding monthly charges, oldest
// first, stopping at the first one credit cannot fully cover.
// Returns the _ids of the charges newly cleared.

export const reconcileMemberCredit = async (memberId, { notify = true } = {}) => {
  const outstandingCharges = await MonthlyCharge.find({
    member: memberId,
    status: "Unpaid",
  })
    .sort({ year: 1, month: 1 })
    .select("_id")
    .lean();

  const cleared = [];

  for (const charge of outstandingCharges) {
    const applied = await applyCreditToMonthlyCharge(memberId, charge._id, { notify });
    if (!applied) break;
    cleared.push(charge._id);
  }

  return cleared;
};

// Credit balance of EVERY member in two queries (reports). Same formula as above.
export const getCreditBalanceMap = async () => {
  const deposits = await Payment.find({ advanceAmount: { $gt: 0 }, status: "completed" })
    .select("member amount advanceAmount")
    .lean();
  if (deposits.length === 0) return new Map();

  const totals = await PaymentAllocation.aggregate([
    { $match: { payment: { $in: deposits.map((d) => d._id) } } },
    { $group: { _id: "$payment", total: { $sum: "$amount" } } },
  ]);
  const allocated = new Map(totals.map((t) => [String(t._id), t.total]));

  const balances = new Map();
  for (const deposit of deposits) {
    const remaining = remainingCredit(deposit, allocated.get(String(deposit._id)) || 0);
    if (remaining > 0) {
      const key = String(deposit.member);
      balances.set(key, (balances.get(key) || 0) + remaining);
    }
  }
  return balances;
};