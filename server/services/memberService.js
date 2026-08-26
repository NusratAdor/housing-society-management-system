import Member     from "../models/Member.js";
import Payment    from "../models/Payment.js";
import ExtraCharge from "../models/ExtraCharge.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import MemberSeat  from "../models/MemberSeat.js";
import Notification from "../models/Notification.js";

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

// ─── cascadeDeleteMember ────────────────────────────────────────────────────
// Removes every record tied to a deleted member: payments, extra
// charges, monthly charges, notifications — and resets their linked
// MemberSeat back to unclaimed so the membership number can be reused.
// Used by BOTH delete paths that can remove a member: an admin
// deleting them directly (adminController.deleteMember), and Clerk's
// own user.deleted webhook (clerkWebhooks.js) when a member deletes
// their account. One shared function means a future fix to cascade
// behavior only ever needs to happen in one place.

export const cascadeDeleteMember = async (memberId, clerkUserId, membershipNo) => {
  await Promise.all([
    Payment.deleteMany({ member: memberId }),
    ExtraCharge.deleteMany({ member: memberId }),
    MonthlyCharge.deleteMany({ member: memberId }),
    Notification.deleteMany({ clerkUserId }),
    membershipNo
      ? MemberSeat.updateOne(
          { membershipNo },
          { $set: { isClaimed: false, claimedByClerkId: null, claimedAt: null, joinDate: null } }
        )
      : Promise.resolve(),
  ]);
};