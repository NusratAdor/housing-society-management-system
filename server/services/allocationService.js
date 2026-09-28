// server/services/allocationService.js
//
// The financial heart of the payment system.
// Handles atomic allocation of a payment to specific charges.
//
// The MongoDB transaction guarantee:
//   Either ALL of these happen together, or NONE of them do:
//     - Payment status → "completed"
//     - Each MonthlyCharge status → "Paid"
//     - Each ExtraCharge status  → "Paid"
//     - PaymentAllocation record created per charge
//     - Receipt number assigned to payment
//
// Wrapped in runInTransactionWithRetry (Mongoose's session.withTransaction()) —
// correctly retries a transient transaction conflict, or retries just
// the commit for an unknown-commit-result, rather than a hand-rolled
// loop that can't safely tell the two apart.
//
// allocatePayment is called ONLY from approvePayment() in
// adminPaymentController.js, on a payment that has already passed
// gateway verification.

import mongoose from "mongoose";
import MonthlyCharge from "../models/MonthlyCharge.js";
import ExtraCharge from "../models/ExtraCharge.js";
import Payment from "../models/Payment.js";
import PaymentAllocation from "../models/PaymentAllocation.js";
import Counter from "../models/Counter.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";

// ─── generateReceiptNumber ────────────────────────────────────────────────
// The sequential number comes from a dedicated Counter document.
// MongoDB's atomic $inc guarantees that two concurrent transactions
// always receive different sequence numbers, so receipt generation
// never depends on counting existing payments.

export const generateReceiptNumber = async (session) => {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { _id: "receipt-sequence" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const seq = String(counter.seq).padStart(6, "0");
  return `RCP-${year}-${seq}`;
};

// ─── allocatePayment ────────────────────────────────────────────────────────

export const allocatePayment = async ({
  paymentId,
  selectedMonthlyIds,
  selectedExtraIds,
  extraChargeAmounts = {},
  confirmedBy,
}) => {
  const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
  const now = new Date();

  return runInTransactionWithRetry(async (session) => {
    const payment = await Payment.findById(paymentObjectId).session(session);

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.status === "completed") {
      // Idempotent: already processed (e.g. a duplicate confirm click).
      return { receiptNumber: payment.receiptNumber, allocations: [] };
    }

    if (payment.status !== "processing") {
      throw new Error(
        `Payment ${paymentId} has status "${payment.status}" — only a payment claimed for processing can be allocated`,
      );
    }

    // ── Step 2: Allocate monthly charges — full amount only ──────────────
    const allocationDocs = [];

    for (const id of selectedMonthlyIds) {
      const chargeId = new mongoose.Types.ObjectId(id);
      const charge = await MonthlyCharge.findById(chargeId).session(session);

      if (!charge) {
        throw new Error(`MonthlyCharge ${id} not found`);
      }
      if (String(charge.member) !== String(payment.member)) {
        throw new Error(
          `MonthlyCharge ${id} does not belong to this payment's member`,
        );
      }
      if (charge.status !== "Unpaid") {
        throw new Error(
          `MonthlyCharge ${id} has status "${charge.status}" — already processed`,
        );
      }

      charge.status = "Paid";
      charge.paidAt = now;
      charge.clearedByPayment = paymentObjectId;
      await charge.save({ session });

      allocationDocs.push({
        payment: paymentObjectId,
        member: charge.member,
        chargeType: "monthly",
        chargeId: chargeId,
        amount: charge.amount,
        allocatedAt: now,
      });
    }

    // ── Step 3: Allocate extra charges — full amount only ─────────────────
    for (const id of selectedExtraIds) {
      const chargeId = new mongoose.Types.ObjectId(id);
      const charge = await ExtraCharge.findById(chargeId).session(session);

      if (!charge) {
        throw new Error(`ExtraCharge ${id} not found`);
      }
      if (String(charge.member) !== String(payment.member)) {
        throw new Error(
          `ExtraCharge ${id} does not belong to this payment's member`,
        );
      }
      if (charge.status !== "Unpaid") {
        throw new Error(
          `ExtraCharge ${id} has status "${charge.status}" — already processed`,
        );
      }

      const payAmount = Object.prototype.hasOwnProperty.call(
        extraChargeAmounts,
        id,
      )
        ? Number(extraChargeAmounts[id])
        : charge.amount;

      if (payAmount !== charge.amount) {
        throw new Error(`ExtraCharge ${id} must be paid in full`);
      }

      charge.status = "Paid";
      charge.paidAt = now;
      charge.clearedByPayment = paymentObjectId;
      await charge.save({ session });

      allocationDocs.push({
        payment: paymentObjectId,
        member: charge.member,
        chargeType: "extra",
        chargeId: chargeId,
        amount: payAmount,
        allocatedAt: now,
      });
    }

    // ── Step 3b: verify the money invariant ────────────────────────────
    const totalAllocated = allocationDocs.reduce((sum, a) => sum + a.amount, 0);
    const expectedChargesPortion =
      payment.amount - (payment.advanceAmount || 0);

    if (Math.abs(totalAllocated - expectedChargesPortion) > 0.01) {
      throw new Error(
        `Allocation mismatch for payment ${paymentId}: allocated ৳${totalAllocated} ` +
          `but expected ৳${expectedChargesPortion} (amount ৳${payment.amount} minus ` +
          `advance ৳${payment.advanceAmount || 0})`,
      );
    }

    // ── Step 4: Insert all PaymentAllocation records ──────────────────
    const allocations = await PaymentAllocation.insertMany(allocationDocs, {
      session,
      ordered: true,
    });

    // ── Step 5: Generate receipt number and mark payment as completed ──
    const receiptNumber = await generateReceiptNumber(session);

    payment.status = "completed";
    payment.paidAt = now;
    payment.receiptNumber = receiptNumber;
    payment.confirmedBy = confirmedBy; // set with completion, atomically
    payment.confirmedAt = now;
    await payment.save({ session });

    return { receiptNumber, allocations };
  });
};
