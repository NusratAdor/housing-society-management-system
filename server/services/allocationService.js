// server/services/allocationService.js
//
// The financial heart of the payment system.
// Handles atomic allocation of a payment to specific charges.
//
// The MongoDB transaction guarantee:
//   Either ALL of these happen together, or NONE of them do:
//     - Payment status → "completed"
//     - Each MonthlyCharge status → "Paid"
//     - Each ExtraCharge status  → "Paid" (or its amount reduced, for a
//       partial payment on a partialPaymentAllowed charge)
//     - PaymentAllocation record created per charge
//     - Receipt number assigned to payment
//
//   If the server crashes mid-allocation, the transaction rolls back.
//   The payment stays "verified" and can be confirmed again safely.
//   Partial states (some charges paid, some not) are impossible.
//
// Why MongoDB transactions are required here:
//   Without a transaction, a server crash between saving charge #1 and
//   charge #2 leaves the member in an inconsistent state — January marked
//   Paid but February still Unpaid, even though money was received for both.
//   The transaction makes the entire operation atomic.
//
// IMPORTANT: MongoDB transactions require a replica set.
//   - MongoDB Atlas: always has a replica set. Works out of the box.
//   - Local development: run `mongod --replSet rs0` or use Docker.
//   - Without replica set: transactions throw an error. Use Atlas for dev.
//
// CHANGE (this pass): allocatePayment is now called ONLY from
// approvePayment() (adminPaymentController.js), on a payment that has
// already passed the gateway-verification stage — never directly from
// the IPN callback anymore. The precondition guard below now reflects
// that actual calling contract: it requires status "verified" instead
// of the old "pending" — a "pending" payment hasn't been confirmed by
// the gateway yet and must never be allocated regardless of who calls
// this function.

import mongoose          from "mongoose";
import MonthlyCharge     from "../models/MonthlyCharge.js";
import ExtraCharge       from "../models/ExtraCharge.js";
import Payment           from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";

// ─── generateReceiptNumber ────────────────────────────────────────────────────
// Generates a unique human-readable receipt number.
// Format: RCP-YYYY-NNNNNN
// Example: RCP-2025-000042
//
// The sequential number is derived from the count of completed payments.
// Why not a UUID: humans need to reference receipt numbers in conversation
// ("my receipt is RCP-2025-000042"). A UUID is not human-friendly.
//
// Race condition note: two simultaneous completions could theoretically
// get the same count. The unique:true index on receiptNumber in the Payment
// schema catches this — one will fail and retry.
// At 500 members this is not a realistic concern.

export const generateReceiptNumber = async (session) => {
  const year  = new Date().getFullYear();
  const count = await Payment.countDocuments(
    { status: "completed" },
    { session }
  );
  // Pad to 6 digits so receipts sort correctly alphabetically
  const seq = String(count + 1).padStart(6, "0");
  return `RCP-${year}-${seq}`;
};

// ─── allocatePayment ──────────────────────────────────────────────────────────
// Atomically allocates a gateway-verified payment to the specified charges.
//
// Parameters:
//   paymentId          — MongoDB _id of the Payment record (status must be
//                        "verified" — i.e. gateway-confirmed, awaiting
//                        admin allocation)
//   selectedMonthlyIds — array of MonthlyCharge _id strings to mark as Paid
//   selectedExtraIds   — array of ExtraCharge _id strings to mark as Paid
//                        (or partially paid down, if partialPaymentAllowed)
//   extraChargeAmounts — { [extraChargeId]: amountBeingPaidNow } — optional.
//                        Defaults to the full charge.amount for any id not
//                        present here, which is identical to pre-existing
//                        behavior for every charge that isn't partial-payment
//                        enabled.
//
// Returns:
//   { receiptNumber, allocations }
//
// This function is called from:
//   - approvePayment() in adminPaymentController.js, when an admin
//     confirms a gateway-verified payment. This is the ONLY caller.

export const allocatePayment = async ({
  paymentId,
  selectedMonthlyIds,
  selectedExtraIds,
  extraChargeAmounts = {},
}) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
  const now             = new Date();

  // Start a MongoDB session for the transaction
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ── Step 1: Lock and verify the payment record ────────────────────────
    // Re-fetch inside the transaction with the session to get a write lock.
    // Check status again — protects against a double-click or a duplicate
    // admin confirmation request racing this one.
    const payment = await Payment.findById(paymentObjectId).session(session);

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.status === "completed") {
      // Idempotent: already processed (e.g. a duplicate confirm click).
      // Commit without doing anything — return existing receipt number.
      await session.commitTransaction();
      return { receiptNumber: payment.receiptNumber, allocations: [] };
    }

    if (payment.status !== "verified") {
      throw new Error(
        `Payment ${paymentId} has status "${payment.status}" — only gateway-verified payments can be allocated`
      );
    }

    // ── Step 2: Allocate monthly charges ──────────────────────────────────
    const allocationDocs = [];

    for (const id of selectedMonthlyIds) {
      const chargeId = new mongoose.Types.ObjectId(id);
      const charge   = await MonthlyCharge.findById(chargeId).session(session);

      if (!charge) {
        throw new Error(`MonthlyCharge ${id} not found`);
      }

      if (charge.status !== "Unpaid") {
        throw new Error(
          `MonthlyCharge ${id} has status "${charge.status}" — already processed`
        );
      }

      // Mark the charge as Paid
      charge.status           = "Paid";
      charge.paidAt           = now;
      charge.clearedByPayment = paymentObjectId;
      await charge.save({ session });

      // Build the allocation record
      allocationDocs.push({
        payment:     paymentObjectId,
        member:      charge.member,
        chargeType:  "monthly",
        chargeId:    chargeId,
        amount:      charge.amount,
        allocatedAt: now,
      });
    }

    // ── Step 3: Allocate extra charges ────────────────────────────────────
    // For a normal (non-partial) charge, payAmount always equals
    // charge.amount, so this takes the exact same "full payment" branch
    // as before — zero behavior change for every existing charge type.
    for (const id of selectedExtraIds) {
      const chargeId = new mongoose.Types.ObjectId(id);
      const charge   = await ExtraCharge.findById(chargeId).session(session);

      if (!charge) {
        throw new Error(`ExtraCharge ${id} not found`);
      }

      if (charge.status !== "Unpaid") {
        throw new Error(
          `ExtraCharge ${id} has status "${charge.status}" — already processed`
        );
      }

      // Defaults to the full charge amount — identical to existing behavior
      // for every charge that isn't partial-payment-enabled.
      const payAmount = Object.prototype.hasOwnProperty.call(extraChargeAmounts, id)
        ? Number(extraChargeAmounts[id])
        : charge.amount;

      if (!Number.isFinite(payAmount) || payAmount <= 0 || payAmount > charge.amount) {
        throw new Error(`Invalid payment amount for ExtraCharge ${id}`);
      }

      if (payAmount === charge.amount) {
        // Full payment — exactly what happens today
        charge.status           = "Paid";
        charge.paidAt           = now;
        charge.clearedByPayment = paymentObjectId;
      } else {
        if (!charge.partialPaymentAllowed) {
          throw new Error(`ExtraCharge ${id} does not support partial payment`);
        }
        // Reduce the outstanding balance; stays "Unpaid" until fully cleared
        charge.amount -= payAmount;
      }

      await charge.save({ session });

      // Build the allocation record — records the actual amount collected,
      // not the (possibly now-reduced) charge total
      allocationDocs.push({
        payment:     paymentObjectId,
        member:      charge.member,
        chargeType:  "extra",
        chargeId:    chargeId,
        amount:      payAmount,
        allocatedAt: now,
      });
    }

    // ── Step 4: Insert all PaymentAllocation records in one operation ─────
    const allocations = await PaymentAllocation.insertMany(
      allocationDocs,
      { session, ordered: true }
    );

    // ── Step 5: Generate receipt number and mark payment as completed ─────
    const receiptNumber = await generateReceiptNumber(session);

    payment.status              = "completed";
    payment.paidAt              = now;
    payment.receiptNumber       = receiptNumber;
    await payment.save({ session });

    // ── Step 6: Commit — all writes become permanent simultaneously ───────
    await session.commitTransaction();

    return { receiptNumber, allocations };
  } catch (error) {
    // Roll back every write made in this transaction
    await session.abortTransaction();
    throw error; // re-throw so the caller can handle appropriately
  } finally {
    // Always end the session regardless of success or failure
    session.endSession();
  }
};