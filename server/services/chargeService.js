// server/services/chargeService.js
//
// Core business logic for creating and querying MonthlyCharge records.
//
// CHANGE (this pass): after creating each month's charges, members with
// an available advance-payment credit balance have it auto-applied
// immediately — see creditService.applyCreditToMonthlyCharge. Checked via
// Payment.advanceAmount > 0 (not a boolean flag), matching the current
// Payment schema.

import mongoose        from "mongoose";
import Member          from "../models/Member.js";
import MonthlyCharge   from "../models/MonthlyCharge.js";
import Payment         from "../models/Payment.js";
import AuditLog        from "../models/AuditLog.js";
import { getFeeForMonth } from "./feeService.js";
import { applyCreditToMonthlyCharge } from "./creditService.js";

export const createMonthlyChargesForMonth = async ({
  month,
  year,
  performedBy = "SYSTEM",
}) => {
  const fee = await getFeeForMonth(month, year);

  const allMembers = await Member
    .find({})
    .select("_id")
    .lean();

  if (allMembers.length === 0) {
    return { created: 0, skipped: 0, fee, month, year };
  }

  const allMemberIds = allMembers.map(m => m._id);

  const existingCharges = await MonthlyCharge
    .find({ month, year, member: { $in: allMemberIds } })
    .select("member")
    .lean();

  const existingMemberIds = new Set(
    existingCharges.map(c => String(c.member))
  );

  const membersNeedingCharge = allMemberIds.filter(
    id => !existingMemberIds.has(String(id))
  );

  const skipped = allMembers.length - membersNeedingCharge.length;

  if (membersNeedingCharge.length === 0) {
    return { created: 0, skipped, fee, month, year };
  }

  const chargeDocuments = membersNeedingCharge.map(memberId => ({
    member: memberId,
    month,
    year,
    amount: fee,
    status: "Unpaid",
  }));

  const insertResult = await MonthlyCharge.insertMany(
    chargeDocuments,
    { ordered: false }
  );

  const created = insertResult.length;

  // ── Auto-apply any available credit balance ────────────────────────────
  // Only members who have ever made a completed advance payment are
  // checked at all — keeps the common case (no one has used advance
  // payment) essentially free instead of computing every member's credit
  // balance on every monthly run.
  try {
    const memberIdsWithCredit = await Payment.distinct("member", {
      advanceAmount: { $gt: 0 },
      status:        "completed",
    });

    if (memberIdsWithCredit.length > 0) {
      const creditMemberSet = new Set(memberIdsWithCredit.map(String));
      const chargesToCheck = insertResult.filter(
        charge => creditMemberSet.has(String(charge.member))
      );

      for (const charge of chargesToCheck) {
        try {
          await applyCreditToMonthlyCharge(charge.member, charge._id);
        } catch (creditError) {
          console.error(
            `[MonthlyCharge] Credit auto-apply failed for member ${charge.member}:`,
            creditError.message
          );
        }
      }
    }
  } catch (creditCheckError) {
    console.error("[MonthlyCharge] Credit auto-apply check failed:", creditCheckError.message);
  }

  await AuditLog.create({
    action:      "MONTHLY_DUES_ADDED",
    performedBy,
    description: `Monthly charges of ৳${fee} created for ${created} member(s) for ${month}/${year}`,
    metadata: {
      month,
      year,
      fee,
      created,
      skipped,
      totalMembers: allMembers.length,
    },
  });

  return { created, skipped, fee, month, year };
};

export const getUnpaidMonthlyChargesForMember = async (memberId) => {
  return MonthlyCharge
    .find({
      member: new mongoose.Types.ObjectId(memberId),
      status: "Unpaid",
    })
    .sort({ year: 1, month: 1 })
    .lean();
};

export const getLast12MonthlyChargesForMember = async (memberId) => {
  return MonthlyCharge
    .find({ member: new mongoose.Types.ObjectId(memberId) })
    .sort({ year: -1, month: -1 })
    .limit(12)
    .lean();
};