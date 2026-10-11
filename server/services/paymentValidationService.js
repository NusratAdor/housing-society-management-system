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

import mongoose from "mongoose";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge from "../models/ExtraCharge.js";
import { getCurrentFee } from "./feeService.js";

import { MAX_PREPAY_MONTHS } from "../configs/paymentConfig.js";
import { getPrepayPlan } from "./feeService.js";
import { getMemberCreditBalance, reconcileMemberCredit } from "./creditService.js";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const validatePaymentSelection = async ({
  memberId,
  selectedMonthlyIds = [],
  selectedExtraIds = [],
  advanceAmount = 0,
}) => {
  // ── Advance amount: strict numeric validation ──────────────────────────
  if (
    advanceAmount !== undefined &&
    advanceAmount !== null &&
    advanceAmount !== 0
  ) {
    if (!Number.isFinite(Number(advanceAmount))) {
      throw new Error("Advance amount must be a valid number");
    }
  }
  const advanceAmt = Number(advanceAmount) || 0;

  if (advanceAmt < 0) {
    throw new Error("Advance amount cannot be negative");
  }

    // The gateway is charged .toFixed(2); more decimals here would make the
  // recorded amount and the charged amount disagree.
  if (Math.abs(advanceAmt * 100 - Math.round(advanceAmt * 100)) > 1e-6) {
    throw new Error("Advance amount can have at most 2 decimal places");
  }

  let existingCredit = 0;
  if (advanceAmt > 0) {
    let newestCharge;
    [newestCharge, existingCredit] = await Promise.all([
      MonthlyCharge.findOne({ member: memberId })
        .sort({ year: -1, month: -1 })
        .select("month year")
        .lean(),
      getMemberCreditBalance(memberId),
    ]);

    const { capacity } = await getPrepayPlan({
      newestCharge,
      creditBalance: existingCredit,
    });

    if (existingCredit + advanceAmt > capacity) {
      throw new Error(
        `Prepaid credit cannot exceed ${MAX_PREPAY_MONTHS} months of fees`,
      );
    }
  }

  // ── Reject duplicate IDs outright — financial input, no ambiguity allowed
  if (
    new Set(selectedMonthlyIds.map(String)).size !== selectedMonthlyIds.length
  ) {
    throw new Error("Duplicate monthly charge selected");
  }
  if (new Set(selectedExtraIds.map(String)).size !== selectedExtraIds.length) {
    throw new Error("Duplicate extra charge selected");
  }

  const hasChargeSelection =
    selectedMonthlyIds.length > 0 || selectedExtraIds.length > 0;

  if (!hasChargeSelection && advanceAmt <= 0) {
    throw new Error(
      "Select at least one charge to pay, or enter an amount to pay in advance",
    );
  }

  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  const allUnpaidMonthly = await MonthlyCharge.find({
    member: memberObjectId,
    status: "Unpaid",
  })
    .sort({ year: 1, month: 1 })
    .lean();

  // ── Validate monthly charge selection ────────────────────────────────
  let selectedMonthly = [];

  if (selectedMonthlyIds.length > 0) {
    if (selectedMonthlyIds.length > allUnpaidMonthly.length) {
      throw new Error(
        `You selected ${selectedMonthlyIds.length} months but only ${allUnpaidMonthly.length} are unpaid`,
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
          "",
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        throw new Error(
          `Payment must follow oldest-first order. ` +
            `${MONTH_NAMES[expectedCharge.month]} ${expectedCharge.year} must be paid before later months.`,
        );
      }
    }

    const validIds = new Set(
      allUnpaidMonthly
        .slice(0, selectedMonthlyIds.length)
        .map((c) => String(c._id)),
    );
    for (const id of selectedMonthlyIds) {
      if (!validIds.has(String(id))) {
        throw new Error(
          "Invalid monthly charge selection: charges must be paid in chronological order",
        );
      }
    }

    selectedMonthly = allUnpaidMonthly.slice(0, selectedMonthlyIds.length);
  }


    // ── Credit shortfall rule ────────────────────────────────────────────────
  // If credit does not fully cover the oldest month that will STILL be unpaid
  // after this payment (typically the fee rose after the member prepaid), the
  // only advance allowed is the exact difference. Further prepaying unlocks
  // once that month is covered.


  
   // ── Advance lock ─────────────────────────────────────────────────────────
  // While a month stays unpaid after this payment, the ONLY advance allowed is
  // the exact amount that completes the oldest such month (fee − credit held).
  // Selection is by charge id, so it does not depend on selection order.
  const selectedMonthlySet = new Set(selectedMonthly.map((c) => String(c._id)));
  const stillUnpaid = allUnpaidMonthly.filter(
    (charge) => !selectedMonthlySet.has(String(charge._id)),
  );

  if (advanceAmt > 0 && stillUnpaid.length > 0) {
    const oldest = stillUnpaid[0];
    const need = Math.max(0, oldest.amount - existingCredit);

        if (need === 0) {
      // Credit already covers this month: apply it NOW rather than making the
      // member wait for the daily sweep. Idempotent and safe to repeat.
      try {
        await reconcileMemberCredit(memberId);
      } catch (error) {
        console.error("[Validation] Immediate credit reconcile failed:", error.message);
      }
      throw new Error(
        "Your credit covers your oldest unpaid month and is being applied. " +
          "Please refresh the page and try again.",
      );
    }

    if (Math.abs(advanceAmt - need) > 0.01) {
      throw new Error(
        `Complete ${MONTH_NAMES[oldest.month]} ${oldest.year} first by paying exactly ` +
          `৳${need.toLocaleString()}. Further advance payments unlock once it is settled.`,
      );
    }
  }

  // NOTE: the old "advanceAmt > 0 requires all unpaid months cleared"
  // check has been intentionally removed — see file header comment.
  // Order-safety is now guaranteed at credit-application time by
  // reconcileMemberCredit(), not at deposit time here.

  // ── Validate extra charge selection ─────────────────────────────────────
  let selectedExtra = [];

  if (selectedExtraIds.length > 0) {
    selectedExtra = await ExtraCharge.find({
      _id: {
        $in: selectedExtraIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
      member: memberObjectId,
      status: "Unpaid",
    }).lean();

    if (selectedExtra.length !== selectedExtraIds.length) {
      const foundIds = new Set(selectedExtra.map((c) => String(c._id)));
      const missingIds = selectedExtraIds.filter(
        (id) => !foundIds.has(String(id)),
      );

      throw new Error(
        `Some extra charges are invalid, already paid, or do not belong to you. ` +
          `Invalid IDs: ${missingIds.join(", ")}`,
      );
    }
  }

  // ── Extra charges: full amount only ─────────────────────────────────────
  const extraChargeAmounts = {};

  for (const charge of selectedExtra) {
    extraChargeAmounts[String(charge._id)] = charge.amount;
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
