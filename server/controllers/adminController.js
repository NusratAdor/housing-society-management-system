// controllers/adminController.js
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";

const normalizePhone = (input) => {
  if (!input) return "";
  return input
    .replace(/[^0-9]/g, "")
    .replace(/^880/, "")
    .replace(/^0+/, "0");
};

export const getAllMembers = async (req, res) => {
  try {
    const members = await Member.find().select("-__v");
    return res.status(200).json({
      success: true,
      members,
      message: members.length ? undefined : "No members found",
    });
  } catch (error) {
    console.error(`getAllMembers error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateMemberProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      designation,
      membershipNo,
      plotNo,
      paymentStatus,
      role,
    } = req.body;

    const normalizedPhone = normalizePhone(phone);

    // Phone validation
    if (
      phone &&
      !/^(013|014|015|016|017|018|019)\d{8}$/.test(normalizedPhone)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }

    // Membership number validation
    const cleanMembership = membershipNo?.trim().toUpperCase();
    if (membershipNo && !/^[A-Za-z0-9-]+$/.test(cleanMembership)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid membership number" });
    }

    // Check for duplicate membership number (excluding current member)
    const existingMembership = await Member.findOne({
      membershipNo: { $regex: new RegExp(`^${cleanMembership}$`, "i") },
      _id: { $ne: id },
    });
    if (existingMembership) {
      return res
        .status(400)
        .json({ success: false, message: "Membership number already used" });
    }

    // Payment status validation
    const validPaymentStatus = ["Pending", "Paid", "Due"];
    if (paymentStatus && !validPaymentStatus.includes(paymentStatus)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment status" });
    }

    // Role validation
    const validRoles = ["member", "admin"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Prepare update data
    const updateData = {
      name: name?.trim(),
      phone: normalizedPhone,
      address: address?.trim(),
      designation: designation?.trim(),
      membershipNo: cleanMembership,
      plotNo: plotNo?.trim(),
      paymentStatus: paymentStatus || "Pending",
      role: role || "member",
    };

    // Fetch old member data for comparison
    const oldMember = await Member.findById(id);
    if (!oldMember) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // Update member
    const updatedMember = await Member.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedMember) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // Auto-update paymentStatus based on dueAmount
    const finalDue = updatedMember.dueAmount || 0;
    const finalStatus =
      finalDue === 0 ? "Paid" : finalDue > 0 ? "Due" : "Pending";

    if (updatedMember.paymentStatus !== finalStatus) {
      updatedMember.paymentStatus = finalStatus;
      await updatedMember.save();
    }

    // Detect changes for notification
    const changes = [];
    if (oldMember.name !== updatedMember.name)
      changes.push(`name → ${updatedMember.name}`);
    if (oldMember.phone !== updatedMember.phone) changes.push("phone");
    if (oldMember.address !== updatedMember.address) changes.push("address");
    if (oldMember.designation !== updatedMember.designation)
      changes.push("designation");
    if (oldMember.membershipNo !== updatedMember.membershipNo)
      changes.push("membership number");
    if (oldMember.plotNo !== updatedMember.plotNo) changes.push("plot number");
    if (oldMember.paymentStatus !== updatedMember.paymentStatus)
      changes.push(`payment status → ${updatedMember.paymentStatus}`);
    if (oldMember.role !== updatedMember.role)
      changes.push(`role → ${updatedMember.role}`);

    if (changes.length > 0 && oldMember.clerkUserId) {
      await Notification.create({
        type: "MemberUpdate",
        content: `Your profile was updated by admin: ${changes.join(", ")}.`,
        clerkUserId: oldMember.clerkUserId,
        adminOnly: false,
      });
    }

    return res.status(200).json({ success: true, member: updatedMember });
  } catch (error) {
    console.error(`updateMemberProfile error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMember = await Member.findByIdAndDelete(id);
    if (!deletedMember) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }
    return res.status(200).json({ success: true, message: "Member deleted" });
  } catch (error) {
    console.error(`deleteMember error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const approveAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedMember = await Member.findByIdAndUpdate(
      id,
      { $set: { role: "admin", pendingAdmin: false } },
      { new: true }
    );
    if (!updatedMember) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }
    // Optional: Notify the new admin
    if (updatedMember.clerkUserId) {
      await Notification.create({
        type: "AdminApproved",
        content: "Congratulations! You have been approved as an admin.",
        clerkUserId: updatedMember.clerkUserId,
        adminOnly: false,
      });
    }
    return res.status(200).json({ success: true, member: updatedMember });
  } catch (error) {
    console.error(`approveAdmin error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};