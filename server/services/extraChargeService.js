// server/services/extraChargeService.js
//
// Business logic for extra charge creation, cancellation, and querying.
// Controllers call these functions — no HTTP concern here.
//
// Key design: when admin creates a charge targeting multiple members,
// we use insertMany() for the entire batch in one operation.
// Each member gets their own ExtraCharge document — not one document
// with an array of member IDs. This is critical because:
//   - Payment allocation is per-member per-charge
//   - Cancellation can happen for one member independently
//   - Status tracking is per member
//   - Notification is per member

import mongoose      from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Member        from "../models/Member.js";
import ExtraCharge   from "../models/ExtraCharge.js";
import Notification  from "../models/Notification.js";
import AuditLog      from "../models/AuditLog.js";

// ─── createExtraCharges ───────────────────────────────────────────────────────
// Creates one ExtraCharge per targeted member.
//
// Parameters:
//   label       (String)  — short name, e.g. "Generator Repair"
//   purpose     (String)  — detailed reason, required so members know why
//   amount      (Number)  — amount in BDT
//   dueDate     (Date)    — optional payment deadline
//   targetType  (String)  — "single" | "multiple" | "all"
//   memberIds   (Array)   — required when targetType is "single" or "multiple"
//   createdBy   (String)  — Clerk userId of the admin
//
// Returns: { created, charges, batchId }

export const createExtraCharges = async ({
  label,
  purpose,
  amount,
  dueDate,
  targetType,
  memberIds,
  createdBy,
}) => {
  // Step 1 — Resolve the list of target Member _ids
  let targetMembers;

  if (targetType === "all") {
    targetMembers = await Member
      .find({})
      .select("_id clerkUserId name")
      .lean();
  } else if (targetType === "single" || targetType === "multiple") {
    if (!memberIds || memberIds.length === 0) {
      throw new Error("memberIds is required for single and multiple targetType");
    }
    targetMembers = await Member
      .find({ _id: { $in: memberIds } })
      .select("_id clerkUserId name")
      .lean();

    // Verify all provided IDs were found
    if (targetMembers.length !== memberIds.length) {
      throw new Error("One or more member IDs were not found");
    }
  } else {
    throw new Error("targetType must be 'single', 'multiple', or 'all'");
  }

  if (targetMembers.length === 0) {
    throw new Error("No members found to charge");
  }

  // Step 2 — Generate a shared batchId
  // All ExtraCharge documents created in this admin action share this ID.
  // This lets admin see "this charge was created for 47 members at once"
  // in the audit log without querying each charge individually.
  const batchId = uuidv4();

  // Step 3 — Build the charge documents
  const chargeDocuments = targetMembers.map(member => ({
    member:    member._id,
    label:     label.trim(),
    purpose:   purpose.trim(),
    amount:    Number(amount),
    dueDate:   dueDate ? new Date(dueDate) : undefined,
    status:    "Unpaid",
    createdBy,
    batchId,
  }));

  // Step 4 — Bulk insert
  const charges = await ExtraCharge.insertMany(chargeDocuments, { ordered: false });

  // Step 5 — Create in-app notification for each targeted member
  // insertMany for notifications too — one DB call for all notifications
  const notificationDocuments = targetMembers.map(member => ({
    type:        "Payment",
    content:     `New charge added to your account: "${label.trim()}" — ৳${Number(amount).toLocaleString()}. Reason: ${purpose.trim()}`,
    clerkUserId: member.clerkUserId,
    adminOnly:   false,
  }));

  await Notification.insertMany(notificationDocuments, { ordered: false });

  // Step 6 — Audit log
  await AuditLog.create({
    action:      "CHARGE_CREATED",
    performedBy: createdBy,
    description: `Extra charge "${label.trim()}" of ৳${amount} created for ${charges.length} member(s)`,
    metadata: {
      batchId,
      label:          label.trim(),
      purpose:        purpose.trim(),
      amount:         Number(amount),
      dueDate:        dueDate || null,
      targetType,
      membersAffected: charges.length,
    },
  });

  return { created: charges.length, charges, batchId };
};

// ─── cancelExtraCharge ────────────────────────────────────────────────────────
// Cancels a single ExtraCharge — sets status to "Cancelled".
//
// Rules:
//   - Only "Unpaid" charges can be cancelled
//   - "Paid" charges are permanent financial records — cannot be cancelled
//   - Cancellation notifies the affected member
//
// Why "Cancelled" status instead of deletion:
//   Deleting records destroys the audit trail.
//   A cancelled charge still shows in history so admin can see
//   "this charge was created then cancelled" — required for a financial audit.

export const cancelExtraCharge = async ({ chargeId, cancelReason, cancelledBy }) => {
  const charge = await ExtraCharge.findById(chargeId).populate("member", "clerkUserId name");

  if (!charge) {
    throw new Error("Charge not found");
  }

  if (charge.status === "Paid") {
    throw new Error("Cannot cancel a charge that has already been paid");
  }

  if (charge.status === "Cancelled") {
    throw new Error("This charge has already been cancelled");
  }

  // Capture before state for audit
  const beforeState = {
    status: charge.status,
    amount: charge.amount,
    label:  charge.label,
  };

  charge.status       = "Cancelled";
  charge.cancelledAt  = new Date();
  charge.cancelReason = cancelReason?.trim() || "";
  await charge.save();

  // Notify the affected member
  await Notification.create({
    type:        "Payment",
    content:     `Charge "${charge.label}" of ৳${charge.amount.toLocaleString()} has been cancelled. ${cancelReason ? `Reason: ${cancelReason.trim()}` : ""}`.trim(),
    clerkUserId: charge.member.clerkUserId,
    adminOnly:   false,
  });

  // Audit log
  await AuditLog.create({
    action:      "CHARGE_CANCELLED",
    performedBy: cancelledBy,
    targetId:    charge._id,
    description: `Extra charge "${charge.label}" of ৳${charge.amount} cancelled for member ${charge.member.name}`,
    before:      beforeState,
    after:       { status: "Cancelled", cancelReason: cancelReason?.trim() || "" },
    metadata:    { batchId: charge.batchId },
  });

  return charge;
};

// ─── getAllExtraCharges ────────────────────────────────────────────────────────
// Returns all extra charges for the admin view, sorted newest first.
// Populates member name and email for display.

export const getAllExtraCharges = async ({
  status,      // optional filter: "Unpaid" | "Paid" | "Cancelled"
  batchId,     // optional filter: show all charges from one batch
  page  = 1,
  limit = 50,
} = {}) => {
  const filter = {};
  if (status)  filter.status  = status;
  if (batchId) filter.batchId = batchId;

  const skip = (page - 1) * limit;

  const [charges, total] = await Promise.all([
    ExtraCharge
      .find(filter)
      .populate("member", "name email membershipNo plotNo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ExtraCharge.countDocuments(filter),
  ]);

  return { charges, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// ─── getUnpaidExtraChargesForMember ──────────────────────────────────────────
// Returns unpaid extra charges for a member, sorted oldest first.
// Used by the due breakdown service (Step 5).

export const getUnpaidExtraChargesForMember = async (memberId) => {
  return ExtraCharge
    .find({
      member: new mongoose.Types.ObjectId(memberId),
      status: "Unpaid",
    })
    .sort({ createdAt: 1 }) // oldest first — so member sees oldest charge first
    .lean();
};