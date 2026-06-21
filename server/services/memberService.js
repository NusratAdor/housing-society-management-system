import Member from "../models/Member.js";

export const findMemberByClerkId = async (clerkUserId) => {
  return await Member.findOne({ clerkUserId }).select("-__v");
};

export const createOrUpdateMember = async (
  clerkUserId,
  memberData
) => {
  const existing = await Member.findOne({ clerkUserId });

  if (existing) {
    return await Member.findOneAndUpdate(
      { clerkUserId },
      { $set: memberData },
      {
        new: true,
        runValidators: true,
      }
    ).select("-__v");
  }

  return await Member.create({
    clerkUserId,
    ...memberData,
  });
};

export const requestAdminAccess = async (clerkUserId) => {
  const member = await Member.findOne({ clerkUserId });

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