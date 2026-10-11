// server/services/memberService.js
//
// CHANGE (this pass): deactivateMember runs in runInTransactionWithRetry (the
// old catch called abortTransaction unconditionally and could crash). The
// last-admin check is protected by a roster lock, so two admins removing or
// demoting each other at the same moment cannot both pass the count.

import Member from "../models/Member.js";
import MemberSeat from "../models/MemberSeat.js";
import Counter from "../models/Counter.js";
import { writeAuditLog } from "./auditService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { httpError } from "../utils/httpError.js";

export const findMemberByClerkId = async (clerkUserId) => {
    return Member.findOne({ clerkUserId }).select("-__v -creditVersion");
};

export const updateOwnMemberProfile = async (clerkUserId, memberData) => {
  return Member.findOneAndUpdate(
    { clerkUserId, status: "active" },
    { $set: memberData },
    { new: true, runValidators: true },
  ).select("-__v");
};

export const requestAdminAccess = async (clerkUserId) => {
  const member = await Member.findOne({ clerkUserId, status: "active" });

  if (!member) throw new Error("Profile not found");
  if (member.role === "admin") throw new Error("You are already an admin");
  if (member.pendingAdmin) throw new Error("Admin request already pending");

  member.pendingAdmin = true;
  await member.save();

  return member;
};

// Every transaction that can reduce the number of active admins writes this
// one document first. Two such transactions then conflict, MongoDB retries
// the loser, and it sees the other's result: the "another admin remains"
// count can no longer be satisfied by two transactions at once.
export const lockAdminRoster = (session) =>
  Counter.updateOne(
    { _id: "admin-roster-lock" },
    { $inc: { seq: 1 } },
    { upsert: true, session },
  );

/**
 * Soft-removes a member and permanently retires their claimed seat.
 *   Member -> removed, MemberSeat -> retired, AuditLog -> MEMBER_REMOVED
 * All three commit together. Historical financial records are NOT deleted.
 *
 * Used by BOTH the admin Remove button and the Clerk user.deleted webhook,
 * so every protection lives here.
 */
export const deactivateMember = async (memberId, membershipNo, performedBy) =>
  runInTransactionWithRetry(async (session) => {
    await lockAdminRoster(session);

    const now = new Date();

    const member = await Member.findOneAndUpdate(
      { _id: memberId, status: "active" },
      {
        $set: {
          status: "removed",
          removedAt: now,
          removedBy: performedBy || null,
        },
      },
      { new: true, session },
    );

    if (!member) throw httpError(404, "Active member not found");

    // Last-admin protection. This member is already "removed" inside this
    // transaction, so it is naturally excluded from the count.
    if (member.role === "admin") {
      const remainingAdminCount = await Member.countDocuments({
        _id: { $ne: member._id },
        role: "admin",
        status: "active",
      }).session(session);

      if (remainingAdminCount === 0) {
        throw httpError(409, "Cannot remove the last active administrator.");
      }
    }

    // The membership number on the Member document is the source of truth;
    // the request parameter is not trusted.
    const seat = await MemberSeat.findOneAndUpdate(
      { membershipNo: member.membershipNo, isClaimed: true, isRetired: false },
      { $set: { isRetired: true, retiredAt: now } },
      { new: true, session },
    );

    if (!seat) throw httpError(409, "Active member seat not found");

    await writeAuditLog({
      action: "MEMBER_REMOVED",
      performedBy,
      targetId: member._id,
      description:
        `Member ${member.name} (${member.membershipNo}) was removed. ` +
        `Membership number permanently retired and historical records preserved.`,
      before: { status: "active", role: member.role },
      after: { status: "removed", role: member.role },
      metadata: { seatRetired: true, dataPreserved: true },
      session,
      required: true,
    });

    return member;
  });