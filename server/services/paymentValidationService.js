// server/services/paymentValidationService.js
//
// Validates a payment selection before creating a gateway session.
// This is security-critical code — it prevents:
//   1. Members paying arbitrary amounts
//   2. Members paying months out of order (skipping older dues)
//   3. Members paying charges that belong to other members
//   4. Members paying charges that are already paid
//   5. Empty payment attempts
//
// Why validation lives in a service and not the controller:
//   The IPN callback (Step 7) also needs to re-validate before allocating.
//   One validation function, two callers — no duplication and no divergence.

import mongoose      from "mongoose";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge   from "../models/ExtraCharge.js";

// ─── validatePaymentSelection ─────────────────────────────────────────────────
// Validates that the member's charge selection is correct and computes
// the verified total amount from the database.
//
// Parameters:
//   memberId           — MongoDB _id of the requesting member
//   selectedMonthlyIds — array of MonthlyCharge _id strings the member wants to pay
//   selectedExtraIds   — array of ExtraCharge _id strings the member wants to pay
//
// Returns:
//   { totalAmount, selectedMonthly, selectedExtra }
//   totalAmount is computed from DB records — the frontend amount is NEVER trusted
//
// Throws descriptive errors for every invalid case.
// The controller converts these to 400 responses.

export const validatePaymentSelection = async ({
  memberId,
  selectedMonthlyIds = [],
  selectedExtraIds   = [],
}) => {
  // ── Guard: at least one charge must be selected ──────────────────────────
  if (selectedMonthlyIds.length === 0 && selectedExtraIds.length === 0) {
    throw new Error("Select at least one charge to pay");
  }

  const memberObjectId = new mongoose.Types.ObjectId(memberId);

  // ── Validate monthly charge selection ────────────────────────────────────
  let selectedMonthly = [];

  if (selectedMonthlyIds.length > 0) {
    // Step 1: Fetch ALL unpaid monthly charges for this member in FIFO order
    // We need the full unpaid list to verify FIFO compliance
    const allUnpaidMonthly = await MonthlyCharge
      .find({ member: memberObjectId, status: "Unpaid" })
      .sort({ year: 1, month: 1 }) // oldest first — the required payment order
      .lean();

    // Step 2: Verify selection count does not exceed available unpaid charges
    if (selectedMonthlyIds.length > allUnpaidMonthly.length) {
      throw new Error(
        `You selected ${selectedMonthlyIds.length} months but only ${allUnpaidMonthly.length} are unpaid`
      );
    }

    // Step 3: FIFO enforcement
    // The selected IDs must exactly match the FIRST N charges in the unpaid list.
    // This prevents paying March without paying January and February.
    //
    // Example: unpaid = [Jan, Feb, Mar, Apr]
    //   ✅ selecting [Jan]           → matches first 1
    //   ✅ selecting [Jan, Feb]      → matches first 2
    //   ✅ selecting [Jan, Feb, Mar] → matches first 3
    //   ❌ selecting [Feb]           → does not match first 1 (Jan is first)
    //   ❌ selecting [Jan, Mar]      → does not match first 2 (Feb is second)
    //   ❌ selecting [Feb, Mar]      → does not match first 2
    //
    // We convert selected IDs to a Set for O(1) lookup, then verify
    // that exactly the first N unpaid charges are selected (no more, no less).
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

    // Step 4: Verify no selected ID is outside the first N unpaid charges
    // (catches the case where someone sends IDs from the middle of the list)
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

    // Step 5: Get the actual charge documents with their locked amounts
    selectedMonthly = allUnpaidMonthly.slice(0, selectedMonthlyIds.length);
  }

  // ── Validate extra charge selection ──────────────────────────────────────
  let selectedExtra = [];

  if (selectedExtraIds.length > 0) {
    // Fetch extra charges matching ALL of these criteria simultaneously:
    //   - ID is in the selected list
    //   - belongs to this member (security: prevent paying other members' charges)
    //   - status is "Unpaid" (prevent double-payment)
    selectedExtra = await ExtraCharge
      .find({
        _id:    { $in: selectedExtraIds.map(id => new mongoose.Types.ObjectId(id)) },
        member: memberObjectId,
        status: "Unpaid",
      })
      .lean();

    // If counts don't match, some charges were invalid
    if (selectedExtra.length !== selectedExtraIds.length) {
      const foundIds   = new Set(selectedExtra.map(c => String(c._id)));
      const missingIds = selectedExtraIds.filter(id => !foundIds.has(String(id)));

      throw new Error(
        `Some extra charges are invalid, already paid, or do not belong to you. ` +
        `Invalid IDs: ${missingIds.join(", ")}`
      );
    }
  }

  // ── Compute verified total from database records ──────────────────────────
  // The frontend sends charge IDs — we look up the actual amounts from the DB.
  // The frontend NEVER sends an amount — this prevents any amount manipulation.
  const totalAmount =
    selectedMonthly.reduce((sum, c) => sum + c.amount, 0) +
    selectedExtra.reduce((sum, c) => sum + c.amount, 0);

  if (totalAmount < 1) {
    throw new Error("Computed payment amount must be at least 1 BDT");
  }

  return {
    totalAmount,
    selectedMonthly,
    selectedExtra,
  };
};