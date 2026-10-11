// server/services/extraChargeService.js
//
// Business logic for extra charge creation, cancellation and querying.
//
// CHANGE (this pass):
//   - CHARGE_CREATED and CHARGE_CANCELLED are audited INSIDE the transaction
//     (required: true): charges + audit commit together or not at all.
//   - Cancel is an atomic conditional update (only from "Unpaid"). It can no
//     longer overwrite a charge that was paid in the meantime, and it refuses a
//     charge that belongs to a payment still in progress.
//   - memberIds are validated and de-duplicated; paging is safe.
//   - Notifications are best-effort AFTER commit, idempotent per charge.
//
// Each member gets their own ExtraCharge document: allocation, cancellation,
// status and notification are all per member.

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Member from "../models/Member.js";
import ExtraCharge from "../models/ExtraCharge.js";
import Payment from "../models/Payment.js";
import Notification from "../models/Notification.js";
import { writeAuditLog } from "./auditService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_TARGET_MEMBERS = 1000;

// Errors the controller may show to the admin as-is.
const businessError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ─── createExtraCharges ───────────────────────────────────────────────────────
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
  let targetMembers;

  if (targetType === "all") {
    targetMembers = await Member.find({ status: "active" })
      .select("_id clerkUserId name")
      .lean();
  } else if (targetType === "single" || targetType === "multiple") {
    const ids = [
      ...new Set((Array.isArray(memberIds) ? memberIds : []).map(String)),
    ];

    if (ids.length === 0) {
      throw businessError("memberIds is required for single and multiple targetType");
    }
    if (ids.length > MAX_TARGET_MEMBERS || !ids.every((id) => OBJECT_ID.test(id))) {
      throw businessError("memberIds contains an invalid member ID");
    }

    targetMembers = await Member.find({ _id: { $in: ids }, status: "active" })
      .select("_id clerkUserId name")
      .lean();

    if (targetMembers.length !== ids.length) {
      throw businessError("One or more member IDs were not found");
    }
  } else {
    throw businessError("targetType must be 'single', 'multiple', or 'all'");
  }

  if (targetMembers.length === 0) {
    throw businessError("No members found to charge");
  }

  // Shared by every charge of this admin action (audit / batch view).
  const batchId = uuidv4();
  const cleanLabel = label.trim();
  const cleanPurpose = purpose.trim();

  const chargeDocuments = targetMembers.map((member) => ({
    member: member._id,
    label: cleanLabel,
    purpose: cleanPurpose,
    amount: Number(amount),
    dueDate: dueDate ? new Date(dueDate) : undefined,
    status: "Unpaid",
    createdBy,
    batchId,
  }));

  // Charges and their required audit commit together.
  const charges = await runInTransactionWithRetry(async (session) => {
    const inserted = await ExtraCharge.insertMany(chargeDocuments, {
      session,
      ordered: true,
    });

    await writeAuditLog({
      action: "CHARGE_CREATED",
      performedBy: createdBy,
      description:
        `Extra charge "${cleanLabel}" of ৳${amount} created for ${inserted.length} member(s)`,
      metadata: {
        batchId,
        label: cleanLabel,
        purpose: cleanPurpose,
        amount: Number(amount),
        dueDate: dueDate || null,
        targetType,
        membersAffected: inserted.length,
      },
      session,
      required: true,
    });

    return inserted;
  });

  // After commit, best-effort: a notification failure must not undo a charge.
  try {
    const clerkByMember = new Map(
      targetMembers.map((m) => [String(m._id), m.clerkUserId]),
    );

    await Notification.insertMany(
      charges
        .filter((charge) => clerkByMember.get(String(charge.member)))
        .map((charge) => ({
          type: "Payment",
          content:
            `New charge added to your account: "${cleanLabel}" — ` +
            `৳${Number(amount).toLocaleString()}. Reason: ${cleanPurpose}`,
          clerkUserId: clerkByMember.get(String(charge.member)),
          adminOnly: false,
          eventKey: `EXTRA_CHARGE:${charge._id}`,
        })),
      { ordered: false },
    );
  } catch (notificationError) {
    console.error("[ExtraCharge] Notifications failed:", notificationError.message);
  }

  return { created: charges.length, charges, batchId };
};

// ─── cancelExtraCharge ────────────────────────────────────────────────────────
// "Cancelled" status, never deletion (a financial audit trail).
//   - Only "Unpaid" can be cancelled; the update itself is conditional, so a
//     charge paid in the meantime can never be overwritten.
//   - A charge inside a pending / verified / processing payment can't be
//     cancelled; the admin must confirm or reject that payment first.

export const cancelExtraCharge = async ({ chargeId, cancelReason, cancelledBy }) => {
  const reason =
    typeof cancelReason === "string" ? cancelReason.trim().slice(0, 500) : "";

  const { charge, memberDoc } = await runInTransactionWithRetry(async (session) => {
    const existing = await ExtraCharge.findById(chargeId).session(session);

    if (!existing) throw businessError("Charge not found", 404);
    if (existing.status === "Paid") {
      throw businessError("Cannot cancel a charge that has already been paid");
    }
    if (existing.status === "Cancelled") {
      throw businessError("This charge has already been cancelled");
    }

    const inFlightPayment = await Payment.exists({
      pendingExtraIds: existing._id,
      status: { $in: ["pending", "verified", "processing"] },
    }).session(session);

    if (inFlightPayment) {
      throw businessError(
        "This charge is part of a payment in progress. Confirm or reject that payment first.",
        409,
      );
    }

    const updated = await ExtraCharge.findOneAndUpdate(
      { _id: existing._id, status: "Unpaid" },
      {
        $set: {
          status: "Cancelled",
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      },
      { new: true, session },
    );

    if (!updated) {
      throw businessError("This charge has already been paid or cancelled");
    }

    const member = await Member.findById(existing.member)
      .select("clerkUserId name")
      .session(session)
      .lean();

    await writeAuditLog({
      action: "CHARGE_CANCELLED",
      performedBy: cancelledBy,
      targetId: updated._id,
      description:
        `Extra charge "${updated.label}" of ৳${updated.amount} cancelled ` +
        `for member ${member?.name ?? existing.member}`,
      before: { status: "Unpaid", amount: existing.amount, label: existing.label },
      after: { status: "Cancelled", cancelReason: reason },
      metadata: { batchId: existing.batchId },
      session,
      required: true,
    });

    return { charge: updated, memberDoc: member };
  });

  // After commit, best-effort.
  try {
    if (memberDoc?.clerkUserId) {
      await Notification.create({
        type: "Payment",
        content:
          `Charge "${charge.label}" of ৳${charge.amount.toLocaleString()} has been cancelled.` +
          (reason ? ` Reason: ${reason}` : ""),
        clerkUserId: memberDoc.clerkUserId,
        adminOnly: false,
        eventKey: `CHARGE_CANCELLED:${charge._id}`,
      });
    }
  } catch (notificationError) {
    console.error("[ExtraCharge] Cancel notification failed:", notificationError.message);
  }

  // Same shape as before: the member is populated on the returned charge.
  await charge.populate("member", "clerkUserId name");
  return charge;
};

// ─── getAllExtraCharges ────────────────────────────────────────────────────────

export const getAllExtraCharges = async ({
  status,
  batchId,
  page = 1,
  limit = 50,
} = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (batchId) filter.batchId = batchId;

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));

  const [charges, total] = await Promise.all([
    ExtraCharge.find(filter)
      .populate("member", "name email membershipNo plots")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    ExtraCharge.countDocuments(filter),
  ]);

  return {
    charges,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
};

// ─── getUnpaidExtraChargesForMember ──────────────────────────────────────────
// Unchanged: unpaid extra charges, oldest first.

export const getUnpaidExtraChargesForMember = async (memberId) => {
  return ExtraCharge.find({
    member: new mongoose.Types.ObjectId(memberId),
    status: "Unpaid",
  })
    .sort({ createdAt: 1 })
    .lean();
};