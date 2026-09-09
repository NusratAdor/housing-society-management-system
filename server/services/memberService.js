import Member       from "../models/Member.js";
import MemberSeat   from "../models/MemberSeat.js";

export const findMemberByClerkId = async (clerkUserId) => {
  return await Member.findOne({ clerkUserId }).select("-__v");
};

export const createOrUpdateMember = async (clerkUserId, memberData) => {
  const existing = await Member.findOne({ clerkUserId });

  if (existing) {
    return await Member.findOneAndUpdate(
      { clerkUserId },
      { $set: memberData },
      { new: true, runValidators: true }
    ).select("-__v");
  }

  return await Member.create({ clerkUserId, ...memberData });
};

export const requestAdminAccess = async (clerkUserId) => {
  const member = await Member.findOne({ clerkUserId });

  if (!member) throw new Error("Profile not found");
  if (member.role === "admin") throw new Error("You are already an admin");
  if (member.pendingAdmin) throw new Error("Admin request already pending");

  member.pendingAdmin = true;
  await member.save();
  return member;
};

// ─── deactivateMember ───────────────────────────────────────────────────────
// Soft-deletes a member: marks them "removed" and permanently retires
// their MemberSeat, but NEVER deletes their Payment, MonthlyCharge,
// ExtraCharge, or Notification records — those stay exactly as they
// are, tied to this now-inactive Member, for historical and audit
// purposes. The membership number itself can never be reused by anyone
// once retired.
//
// Used by BOTH removal paths: an admin removing a member directly
// (adminController.deleteMember), and Clerk's own user.deleted webhook
// (clerkWebhooks.js) when a member deletes their own account. One
// shared function means a future change to this behavior only ever
// needs to happen in one place.

export const deactivateMember = async (memberId, clerkUserId, membershipNo, performedBy) => {
  const now = new Date();

  await Promise.all([
    Member.updateOne(
      { _id: memberId },
      { $set: { status: "removed", removedAt: now, removedBy: performedBy || null } }
    ),
    membershipNo
      ? MemberSeat.updateOne(
          { membershipNo },
          { $set: { isRetired: true, retiredAt: now } }
        )
      : Promise.resolve(),
  ]);
};