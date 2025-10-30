// controllers/memberController.js (updated)
import Member from "../models/Member.js";

const normalizePhone = (input) => {
  if (!input) return "";
  return input.replace(/[^0-9]/g, "").replace(/^880/, "").replace(/^0+/, "0");
};

export const createMemberProfile = async (req, res) => {
  try {
    const { name, email, phone, address, designation, membershipNo, plotNo } = req.body;
    const { clerkUserId } = req;

    if (!clerkUserId || !email) {
      return res.status(400).json({ success: false, message: !clerkUserId ? "User ID missing" : "Email required" });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!/^(013|014|015|016|017|018|019)\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: "Invalid phone" });
    }

    const cleanMembership = membershipNo?.trim().toUpperCase();
    if (!/^[A-Za-z0-9-]+$/.test(cleanMembership)) {
      return res.status(400).json({ success: false, message: "Invalid membership" });
    }

    const existingMembership = await Member.findOne({
      membershipNo: { $regex: new RegExp(`^${cleanMembership}$`, "i") },
    });
    if (existingMembership && existingMembership.clerkUserId !== clerkUserId) {
      return res.status(400).json({ success: false, message: "Membership already used" });
    }

    const existing = await Member.findOne({ clerkUserId });
    const memberData = {
      name: name?.trim(),
      email: email?.trim().toLowerCase(),
      phone: normalizedPhone,
      address: address?.trim(),
      designation: designation?.trim(),
      membershipNo: cleanMembership,
      plotNo: plotNo?.trim(),
      role: existing?.role || "member",
    };

    const member = existing
      ? await Member.findOneAndUpdate({ clerkUserId }, { $set: memberData }, { new: true })
      : await Member.create({ clerkUserId, ...memberData });

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? "Profile updated" : "Profile created",
      member,
    });
  } catch (error) {
    console.error(`createMemberProfile error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMemberProfile = async (req, res) => {
  try {
    const { clerkUserId } = req;
    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    if (clerkUserId === process.env.ADMIN_CLERK_ID) {
      return res.status(200).json({
        success: true,
        member: {
          clerkUserId,
          name: process.env.ADMIN_NAME || "Admin",
          email: process.env.ADMIN_EMAIL || "admin@example.com",
          role: "admin",
          phone: "",
          address: "",
          designation: "Administrator",
          membershipNo: "",
          plotNo: "",
          paymentStatus: "Paid",
          pendingAdmin: false,
        },
      });
    }

    const member = await Member.findOne({ clerkUserId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    return res.status(200).json({ success: true, member });
  } catch (error) {
    console.error(`getMemberProfile error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// New endpoint for requesting admin status
export const requestAdmin = async (req, res) => {
  try {
    const { clerkUserId } = req;
    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    const member = await Member.findOne({ clerkUserId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    if (member.role === "admin") {
      return res.status(400).json({ success: false, message: "You are already an admin" });
    }

    if (member.pendingAdmin) {
      return res.status(400).json({ success: false, message: "Admin request already pending" });
    }

    const updatedMember = await Member.findOneAndUpdate(
      { clerkUserId },
      { $set: { pendingAdmin: true } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Admin request submitted successfully",
      member: updatedMember,
    });
  } catch (error) {
    console.error(`requestAdmin error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
