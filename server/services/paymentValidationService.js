// server/services/paymentValidationService.js
//
// Validates a payment selection before creating a gateway session.
// This is security-critical code.
//
// CHANGE (this pass):
//   1. Removed the "must clear all unpaid months before any advance"
//      rule. That rule existed to stop banked credit from skipping
//      ahead of an older unpaid month — but reconcileMemberCredit()
//      (creditService.js) already enforces that guarantee itself,
//      strictly oldest-first and all-or-nothing, no matter when or how
//      credit arrives. With that enforcement in place at the point
//      credit is actually APPLIED, restricting it at the point credit
//      is DEPOSITED is redundant and blocks a legitimate case: a
//      member topping up existing insufficient credit (e.g. ৳800
//      banked, adds ৳200) so their oldest outstanding month can finally
//      be fully covered.
//   2. Added explicit numeric validation for advanceAmount — no longer
//      silently coerces invalid input to 0.
//   3. Added explicit duplicate-ID rejection for both selection arrays.

import mongoose      from "mongoose";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge   from "../models/ExtraCharge.js";
import { getCurrentFee } from "./feeService.js";
import { getMemberCreditBalance } from "./creditService.js";
import { MAX_PREPAY_MONTHS } from "../configs/paymentConfig.js";

export const validatePaymentSelection = async ({
  memberId,
  selectedMonthlyIds = [],
  selectedExtraIds   = [],
  partialAmounts     = {},
  advanceAmount      = 0,
}) => {
  // ── Advance amount: strict numeric validation ──────────────────────────
  if (advanceAmount !== undefined && advanceAmount !== null && advanceAmount !== 0) {
    if (!Number.isFinite(Number(advanceAmount))) {
      throw new Error("Advance amount must be a valid number");
    }
  }
  const advanceAmt = Number(advanceAmount) || 0;

  if (advanceAmt < 0) {
    throw new Error("Advance amount cannot be negative");
  }

  if (advanceAmt > 0) {
  const [fee, existingCredit] = await Promise.all([
    getCurrentFee(),
    getMemberCreditBalance(memberId),
  ]);
  if (existingCredit + advanceAmt > fee * MAX_PREPAY_MONTHS) {
    throw new Error(
      `Prepaid credit cannot exceed ${MAX_PREPAY_MONTHS} months of fees`,
    );
  }
}

  // ── Reject duplicate IDs outright — financial input, no ambiguity allowed
  if (new Set(selectedMonthlyIds.map(String)).size !== selectedMonthlyIds.length) {
    throw new Error("Duplicate monthly charge selected");
  }
  if (new Set(selectedExtraIds.map(String)).size !== selectedExtraIds.length) {
    throw new Error("Duplicate extra charge selected");
  }

  const hasChargeSelection = selectedMonthlyIds.length > 0 || selectedExtraIds.length > 0;

  if (!hasChargeSelection && advanceAmt <= 0) {
    throw new Error("Select at least one charge to pay, or enter an amount to pay in advance");
  }

  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const allUnpaidMonthly = await MonthlyCharge
    .find({ member: memberObjectId, status: "Unpaid" })
    .sort({ year: 1, month: 1 })
    .lean();

  // ── Validate monthly charge selection ────────────────────────────────
  let selectedMonthly = [];

  if (selectedMonthlyIds.length > 0) {
    if (selectedMonthlyIds.length > allUnpaidMonthly.length) {
      throw new Error(
        `You selected ${selectedMonthlyIds.length} months but only ${allUnpaidMonthly.length} are unpaid`
      );
    }

    const selectedSet = new Set(selectedMonthlyIds.map(String));

    for (let i = 0; i < selectedMonthlyIds.length; i++) {
      const expectedCharge = allUnpaidMonthly[i];

      if (!expectedCharge) {
        throw new Error("Invalid monthly charge selection: index out of range");
      }

      if (!selectedSet.has(String(expectedCharge._id))) {
        const MONTH_NAMES = [
          "", "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December",
        ];
        throw new Error(
          `Payment must follow oldest-first order. ` +
          `${MONTH_NAMES[expectedCharge.month]} ${expectedCharge.year} must be paid before later months.`
        );
      }
    }

    const validIds = new Set(
      allUnpaidMonthly.slice(0, selectedMonthlyIds.length).map(c => String(c._id))
    );
    for (const id of selectedMonthlyIds) {
      if (!validIds.has(String(id))) {
        throw new Error(
          "Invalid monthly charge selection: charges must be paid in chronological order"
        );
      }
    }

    selectedMonthly = allUnpaidMonthly.slice(0, selectedMonthlyIds.length);
  }

  // NOTE: the old "advanceAmt > 0 requires all unpaid months cleared"
  // check has been intentionally removed — see file header comment.
  // Order-safety is now guaranteed at credit-application time by
  // reconcileMemberCredit(), not at deposit time here.

  // ── Validate extra charge selection ─────────────────────────────────────
  let selectedExtra = [];

  if (selectedExtraIds.length > 0) {
    selectedExtra = await ExtraCharge
      .find({
        _id:    { $in: selectedExtraIds.map(id => new mongoose.Types.ObjectId(id)) },
        member: memberObjectId,
        status: "Unpaid",
      })
      .lean();

    if (selectedExtra.length !== selectedExtraIds.length) {
      const foundIds   = new Set(selectedExtra.map(c => String(c._id)));
      const missingIds = selectedExtraIds.filter(id => !foundIds.has(String(id)));

      throw new Error(
        `Some extra charges are invalid, already paid, or do not belong to you. ` +
        `Invalid IDs: ${missingIds.join(", ")}`
      );
    }
  }

  // ── Extra charges: full amount only ─────────────────────────────────────
  const partialKeys = Object.keys(partialAmounts);
  for (const key of partialKeys) {
    if (!selectedExtraIds.map(String).includes(String(key))) {
      throw new Error("Partial amount provided for a charge that was not selected");
    }
  }

  const extraChargeAmounts = {};
  for (const charge of selectedExtra) {
    const cid = String(charge._id);
    if (Object.prototype.hasOwnProperty.call(partialAmounts, cid)) {
      throw new Error(`"${charge.label}" does not support partial payment`);
    }
    extraChargeAmounts[cid] = charge.amount;
  }

  // ── Compute verified total from database records ────────────────────────
  const totalAmount =
    selectedMonthly.reduce((sum, c) => sum + c.amount, 0) +
    Object.values(extraChargeAmounts).reduce((sum, amt) => sum + amt, 0) +
    advanceAmt;

   if (totalAmount < 1) {
    throw new Error("Computed payment amount must be at least 1 BDT");
  }


  return {
    totalAmount,
    selectedMonthly,
    selectedExtra,
    extraChargeAmounts,
    advanceAmount: advanceAmt,
  };
};