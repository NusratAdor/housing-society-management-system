// server/services/paymentValidationService.js
//
// Validates a payment selection before creating a gateway session.
// This is security-critical code — it prevents:
//   1. Members paying arbitrary amounts
//   2. Members paying months out of order (skipping older dues)
//   3. Members paying charges that belong to other members
//   4. Members paying charges that are already paid
//   5. Empty payment attempts (unless offset by a valid advance amount)
//   6. Members paying a partial amount on a charge that doesn't allow it,
//      or a partial amount that is invalid or exceeds the outstanding balance
//   7. A negative or invalid advance-payment amount
//
// CHANGE (this pass): a member may now optionally add an advanceAmount
// alongside (or instead of) a charge selection — e.g. pay this month's
// due plus extra to bank as credit for a future month, in one payment.
// There is no longer a "must have zero current dues" restriction — the
// charges portion and the advance portion are simply two independent
// numbers that sum to the total charged.

import mongoose      from "mongoose";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge   from "../models/ExtraCharge.js";

export const validatePaymentSelection = async ({
  memberId,
  selectedMonthlyIds = [],
  selectedExtraIds   = [],
  partialAmounts     = {},
  advanceAmount      = 0,
}) => {
  const advanceAmt = Number(advanceAmount) || 0;

  if (advanceAmt < 0) {
    throw new Error("Advance amount cannot be negative");
  }

  const hasChargeSelection = selectedMonthlyIds.length > 0 || selectedExtraIds.length > 0;

  // ── Guard: must select at least one charge, or add a valid advance ───────
  if (!hasChargeSelection && advanceAmt <= 0) {
    throw new Error("Select at least one charge to pay, or enter an amount to pay in advance");
  }

  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  // ── Validate monthly charge selection ────────────────────────────────────
  let selectedMonthly = [];

  if (selectedMonthlyIds.length > 0) {
    const allUnpaidMonthly = await MonthlyCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ year: 1, month: 1 })
      .lean();

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

  // ── Validate extra charge selection ──────────────────────────────────────
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

  // ── Resolve the actual amount being collected per extra charge ───────────
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
      if (!charge.partialPaymentAllowed) {
        throw new Error(`"${charge.label}" does not support partial payment`);
      }
      const requested = Number(partialAmounts[cid]);
      if (!Number.isFinite(requested) || requested <= 0) {
        throw new Error(`Invalid partial payment amount for "${charge.label}"`);
      }
      if (requested > charge.amount) {
        throw new Error(
          `Partial payment for "${charge.label}" cannot exceed the outstanding ৳${charge.amount}`
        );
      }
      extraChargeAmounts[cid] = Math.round(requested);
    } else {
      extraChargeAmounts[cid] = charge.amount;
    }
  }

  // ── Compute verified total from database records ──────────────────────────
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