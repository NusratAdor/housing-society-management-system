// server/models/ExtraCharge.js
//
// Admin-initiated one-off charges assigned to one or more members.
// Examples: generator repair, festival donation, security upgrade.
// Also used for the system-generated Opening Balance charge (see
// memberController.js), which is the only charge type that currently
// sets partialPaymentAllowed: true.
//
// When admin creates a charge targeting 50 members, 50 ExtraCharge
// documents are created — one per member. This design means:
//   - Each member's charge can be cancelled independently
//   - Each charge has its own payment allocation record
//   - Each charge tracks its own payment status independently
//
// Why not one charge document with an array of member IDs:
//   An array would make per-member cancellation, per-member payment
//   allocation, and per-member status tracking extremely complicated.
//   One document per member keeps every operation simple and clean.

import mongoose from "mongoose";

const extraChargeSchema = new mongoose.Schema(
  {
    member: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Member",
      required: true,
    },

    // Short display name — shown on dashboard and receipts
    // Example: "Generator Repair"
    label: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },

    // Detailed explanation — members must know WHY they owe this
    // Example: "Emergency generator repair after power surge on 15 Jan 2025"
    purpose: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 1000,
    },

    // Current outstanding amount. For a partial-payment-enabled charge,
    // this is REDUCED by each partial payment (see allocationService.js)
    // rather than being locked forever — unlike originalAmount below.
    amount: {
      type:     Number,
      required: true,
      min:      [1, "Charge amount must be at least 1 BDT"],
    },

    // Locked at creation time, never changes. Lets the UI show
    // "৳2,000 paid of ৳4,800" even after `amount` is reduced by partial
    // payments. undefined/null for every charge that isn't partial-payment
    // enabled — identical to their current behavior.
    originalAmount: {
      type: Number,
    },

    // true only for charges that support paying less than the full
    // balance (currently: the Opening Balance charge). Everything else
    // (generator repair, festival donation, etc.) must be paid in full,
    // exactly as today. Defaults to false so every existing charge and
    // every existing full-payment flow behaves identically.
    partialPaymentAllowed: {
      type:    Boolean,
      default: false,
    },

    // Optional payment deadline for this charge
    dueDate: {
      type: Date,
    },

    // "Unpaid"    → charge exists, not yet cleared by payment
    // "Paid"      → cleared by a PaymentAllocation
    // "Cancelled" → admin cancelled this charge (only if Unpaid)
    status: {
      type:    String,
      enum:    ["Unpaid", "Paid", "Cancelled"],
      default: "Unpaid",
    },

    paidAt: {
      type: Date,
    },

    // Set when status transitions to "Cancelled"
    cancelledAt: {
      type: Date,
    },

    cancelReason: {
      type:    String,
      default: "",
      trim:    true,
    },

    // Clerk userId of the admin who created this charge — for audit display
    createdBy: {
      type:     String,
      required: true,
      trim:     true,
    },

    // Reference to the Payment that cleared this charge
    clearedByPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Payment",
    },

    // Links this charge to a "batch" when admin creates one charge for many members.
    // All charges created in the same admin action share the same batchId.
    // This lets the admin see "I created this charge for 47 members" in the audit.
    batchId: {
      type:  String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Most common query: unpaid extra charges for a member
extraChargeSchema.index({ member: 1, status: 1 });

// For admin "all charges" view sorted by newest first
extraChargeSchema.index({ createdAt: -1 });

export default mongoose.model("ExtraCharge", extraChargeSchema);