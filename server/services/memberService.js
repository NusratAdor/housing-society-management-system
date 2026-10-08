import Member from "../models/Member.js";
import MemberSeat from "../models/MemberSeat.js";
import { writeAuditLog } from "./auditService.js";

export const findMemberByClerkId = async (clerkUserId) => {
  return Member.findOne({
    clerkUserId,
  }).select("-__v");
};

export const updateOwnMemberProfile = async (
  clerkUserId,
  memberData,
) => {
  return Member.findOneAndUpdate(
    {
      clerkUserId,
      status: "active",
    },
    {
      $set: memberData,
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("-__v");
};

export const requestAdminAccess = async (clerkUserId) => {
  const member = await Member.findOne({
    clerkUserId,
    status: "active",
  });

  if (!member) {
    throw new Error("Profile not found");
  }

  if (member.role === "admin") {
    throw new Error("You are already an admin");
  }

  if (member.pendingAdmin) {
    throw new Error("Admin request already pending");
  }

  member.pendingAdmin = true;

  await member.save();

  return member;
};

/**
 * Soft-removes a member and permanently retires their claimed seat.
 *
 * This operation is intentionally transactional:
 *
 *   Member -> removed
 *   MemberSeat -> retired
 *   AuditLog -> MEMBER_REMOVED
 *
 * All three must succeed together.
 *
 * Historical financial records are NOT deleted.
 */
export const deactivateMember = async (
  memberId,
  membershipNo,
  performedBy,
) => {
  const session = await Member.startSession();

  try {
    session.startTransaction();

    const now = new Date();

    const member = await Member.findOneAndUpdate(
      {
        _id: memberId,
        status: "active",
      },
      {
        $set: {
          status: "removed",
          removedAt: now,
          removedBy: performedBy || null,
        },
      },
      {
        new: true,
        session,
      },
    );

    if (!member) {
      throw new Error("Active member not found");
    }

    /*
     * Last-admin protection.
     *
     * A member with role "admin" can also be removed, so we must make
     * sure at least one other active admin remains in the system.
     *
     * Because the member above has already been changed to "removed"
     * inside this transaction, it is naturally excluded from this count.
     */
    if (member.role === "admin") {
  const remainingAdminCount = await Member.countDocuments({
    _id: { $ne: member._id },
    role: "admin",
    status: "active",
  }).session(session);

  if (remainingAdminCount === 0) {
    const error = new Error(
      "Cannot remove the last active administrator.",
    );

    error.statusCode = 409;

    throw error;
  }
}

    /*
     * Retire the authoritative membership seat.
     *
     * The membership number stored on the Member document is the
     * source of truth. We do not trust the request parameter here.
     */
    const seat = await MemberSeat.findOneAndUpdate(
      {
        membershipNo: member.membershipNo,
        isClaimed: true,
        isRetired: false,
      },
      {
        $set: {
          isRetired: true,
          retiredAt: now,
        },
      },
      {
        new: true,
        session,
      },
    );

    if (!seat) {
      throw new Error("Active member seat not found");
    }

    await writeAuditLog({
      action: "MEMBER_REMOVED",
      performedBy,
      targetId: member._id,
      description:
        `Member ${member.name} (${member.membershipNo}) was removed. ` +
        `Membership number permanently retired and historical records preserved.`,
      before: {
        status: "active",
        role: member.role,
      },
      after: {
        status: "removed",
        role: member.role,
      },
      metadata: {
        seatRetired: true,
        dataPreserved: true,
      },
      session,
      required: true,
    });

    await session.commitTransaction();

    return member;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};