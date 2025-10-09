import Member from "../models/Member.js";

export const createMemberProfile = async (req, res) => {
  try {
    const { name, email, phone, address, designation, membershipNo, plotNo } = req.body;
    const clerkUserId = req.clerkUserId;

    // Validate inputs
    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "Clerk user ID is missing" });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    // Normalize phone number
    const normalizedPhone = phone.replace(/[\s-+]/g, "").replace(/^\+880/, "");
    if (!/^(013|014|015|016|017|018|019)\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be a valid 11-digit Bangladeshi mobile number (e.g., 01712345678)",
      });
    }
    if (!/^[A-Za-z0-9-]+$/.test(membershipNo)) {
      return res.status(400).json({
        success: false,
        message: "Membership number must contain only letters, numbers, or hyphens",
      });
    }

    // Check for unique membership number
    const existingMembership = await Member.findOne({ membershipNo });
    if (existingMembership && existingMembership.clerkUserId !== clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "Membership number already in use",
      });
    }

    // Check for existing profile
    const existing = await Member.findOne({ clerkUserId });
    if (existing) {
      const updatedMember = await Member.findOneAndUpdate(
        { clerkUserId },
        { name, email, phone: normalizedPhone, address, designation, membershipNo, plotNo },
        { new: true }
      );
      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        member: updatedMember,
      });
    }

    // Create new member
    const newMember = await Member.create({
      clerkUserId,
      name,
      email,
      phone: normalizedPhone,
      address,
      designation,
      membershipNo,
      plotNo,
    });

    return res.status(201).json({
      success: true,
      message: "Profile created successfully",
      member: newMember,
    });
  } catch (error) {
    console.error(`Error creating/updating profile: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMemberProfile = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "Clerk user ID is missing" });
    }

    const member = await Member.findOne({ clerkUserId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    return res.json({ success: true, member });
  } catch (error) {
    console.error(`Error fetching profile: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};