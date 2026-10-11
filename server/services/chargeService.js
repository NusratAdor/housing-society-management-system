// server/services/chargeService.js
//
// Core business logic for creating and querying MonthlyCharge records.
// No req/res knowledge — pure functions called by controllers and cron jobs.
//
// CHANGE (this pass): createMonthlyChargesForMonth now refuses a FUTURE
// month. Business rule: future payment is handled through credit, never by
// creating fake future monthly charges. The guard lives here (not only in
// the controller) so the cron job and the manual trigger are both covered.

import mongoose from "mongoose";
import Member from "../models/Member.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import Payment from "../models/Payment.js";
import { getFeeForMonth } from "./feeService.js";
import { reconcileMemberCredit } from "./creditService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { writeAuditLog } from "./auditService.js";
import { getDhakaDateParts } from "../utils/dateTime.js";
import { notifyMonthlyFeeAdded } from "./paymentNotificationService.js";

// ─── createMonthlyChargesForMonth ─────────────────────────────────────────────
// One MonthlyCharge per ACTIVE member for the given month/year, amount locked
// from FeeHistory. Idempotent: members who already have a charge are skipped.
//
// Called by: paymentJobs.js cron, adminPaymentController.triggerMonthlyDue.

export const createMonthlyChargesForMonth = async ({
  month,
  year,
  performedBy = "SYSTEM",
}) => {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    const error = new Error("Invalid month or year");
    error.statusCode = 400;
    throw error;
  }

  const { year: currentYear, month: currentMonth } = getDhakaDateParts();
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    const error = new Error("Monthly charges cannot be created for a future month");
    error.statusCode = 400;
    throw error;
  }

  // FeeHistory is the financial source of truth.
  const fee = await getFeeForMonth(month, year);

  const result = await runInTransactionWithRetry(async (session) => {
    const allMembers = await Member.find({ status: "active" })
      .select("_id")
      .session(session)
      .lean();

    if (allMembers.length === 0) {
      return { created: 0, skipped: 0, totalMembers: 0 };
    }

    const operations = allMembers.map(({ _id }) => ({
      updateOne: {
        filter: { member: _id, month, year },
        update: {
          $setOnInsert: {
            member: _id,
            month,
            year,
            amount: fee,
            status: "Unpaid",
          },
        },
        upsert: true,
      },
    }));

    const bulkResult = await MonthlyCharge.bulkWrite(operations, {
      session,
      ordered: false,
    });

    const created = bulkResult.upsertedCount || 0;
    const skipped = allMembers.length - created;

    // Critical financial audit is part of the same transaction.
    if (created > 0) {
      await writeAuditLog({
        action: "MONTHLY_DUES_ADDED",
        performedBy,
        description:
          `Monthly charges of ৳${fee} created for ${created} member(s) ` +
          `for ${month}/${year}.`,
        metadata: {
          month,
          year,
          fee,
          created,
          skipped,
          totalMembers: allMembers.length,
        },
        session,
        required: true,
      });
    }

    return { created, skipped, totalMembers: allMembers.length };
  });

   // Announce the new month BEFORE credit is applied, so a member's messages
  // read in order: "fee added" → "paid from credit" (or "credit short").
  // Idempotent: the event key is per month, so catch-up runs never repeat it.
 if (result.created > 0) {
  try {
    await notifyMonthlyFeeAdded({ month, year, fee });
  } catch (notificationError) {
    console.error(
      "[MonthlyCharge] Monthly fee notification failed:",
      notificationError.message,
    );
  }
}


  if (result.created > 0) {
    try {
      const memberIdsWithCredit = await Payment.distinct("member", {
        advanceAmount: { $gt: 0 },
        status: "completed",
      });

      for (const memberId of memberIdsWithCredit) {
        try {
          await reconcileMemberCredit(memberId);
        } catch (creditError) {
          console.error(
            `[MonthlyCharge] Credit reconciliation failed for member ${memberId}:`,
            creditError.message,
          );
        }
      }
    } catch (creditCheckError) {
      console.error(
        "[MonthlyCharge] Credit auto-apply check failed:",
        creditCheckError.message,
      );
    }
  }

  return {
    created: result.created,
    skipped: result.skipped,
    fee,
    month,
    year,
  };
};

// ─── Unpaid monthly charges, oldest first (FIFO order for the payment UI) ────

export const getUnpaidMonthlyChargesForMember = async (memberId) => {
  return MonthlyCharge.find({
    member: new mongoose.Types.ObjectId(memberId),
    status: "Unpaid",
  })
    .sort({ year: 1, month: 1 })
    .lean();
};

// ─── Last 12 monthly charges (paid or unpaid), most recent first ─────────────

export const getLast12MonthlyChargesForMember = async (memberId) => {
  return MonthlyCharge.find({ member: new mongoose.Types.ObjectId(memberId) })
    .sort({ year: -1, month: -1 })
    .limit(12)
    .lean();
};