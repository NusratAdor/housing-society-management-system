// server/controllers/adminController.js
// Every state-changing operation now writes an AuditLog via writeAuditLog().
// The audit write is after the main operation and uses fire-and-forget
// so a log write failure never causes the operation to return an error.

import Member          from "../models/Member.js";
import Payment         from "../models/Payment.js";
import Charge          from "../models/ExtraCharge.js";
import Notification    from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";

// ─── Cascade delete helper ────────────────────────────────────────────────────
// Used by deleteMember and clerkWebhooks.
// Exported so clerkWebhooks can call it without importing the whole controller.

export const cascadeDeleteMember = async (memberId, clerkUserId) => {
  await Promise.all([
    Payment.deleteMany({ member: memberId }),
    Charge.deleteMany({ member: memberId }),
    Notification.deleteMany({ clerkUserId }),
  ]);
};

// ─── getAllMembers ─────────────────────────────────────────────────────────────

export const getAllMembers = async (req, res) => {
  try {
    const members = await Member.find().select("-__v").lean();
    return res.status(200).json({ success: true, members });
  } catch (error) {
    console.error("getAllMembers error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── updateMemberProfile ──────────────────────────────────────────────────────

export const updateMemberProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, phone, address, designation,
      membershipNo, plotNo, role, pendingAdmin,
    } = req.body;

    // Validation
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number" });
    }

    const cleanMembership = membershipNo?.trim().toUpperCase();
    if (membershipNo && !/^[A-Za-z0-9-]+$/.test(cleanMembership)) {
      return res.status(400).json({ success: false, message: "Invalid membership number" });
    }
    if (membershipNo) {
      const dup = await Member.findOne({
        membershipNo: { $regex: new RegExp(`^${cleanMembership}$`, "i") },
        _id: { $ne: id },
      });
      if (dup) {
        return res.status(400).json({ success: false, message: "Membership number already used" });
      }
    }

    const validRoles = ["member", "admin"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const oldMember = await Member.findById(id);
    if (!oldMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // Snapshot before state for audit
    const beforeSnapshot = {
      name:         oldMember.name,
      phone:        oldMember.phone,
      address:      oldMember.address,
      designation:  oldMember.designation,
      membershipNo: oldMember.membershipNo,
      plotNo:       oldMember.plotNo,
      role:         oldMember.role,
      pendingAdmin: oldMember.pendingAdmin,
    };

    // Build update — only include fields that were sent
    const updateData = {
      ...(name         !== undefined && { name:         name.trim() }),
      ...(phone        !== undefined && { phone:        normalizePhone(phone) }),
      ...(address      !== undefined && { address:      address.trim() }),
      ...(designation  !== undefined && { designation:  designation.trim() }),
      ...(cleanMembership            && { membershipNo: cleanMembership }),
      ...(plotNo       !== undefined && { plotNo:       plotNo.trim() }),
      ...(role         !== undefined && { role }),
      ...(pendingAdmin !== undefined && { pendingAdmin }),
    };

    const updated = await Member.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // Snapshot after state
    const afterSnapshot = {
      name:         updated.name,
      phone:        updated.phone,
      address:      updated.address,
      designation:  updated.designation,
      membershipNo: updated.membershipNo,
      plotNo:       updated.plotNo,
      role:         updated.role,
      pendingAdmin: updated.pendingAdmin,
    };

    // Detect human-readable change list for notification
    const fieldLabels = {
      name:         "name",
      phone:        "phone",
      address:      "address",
      designation:  "designation",
      membershipNo: "membership number",
      plotNo:       "plot number",
      role:         "role",
    };

    const changes = Object.entries(fieldLabels)
      .filter(([f]) => String(oldMember[f] ?? "") !== String(updated[f] ?? ""))
      .map(([f, label]) => `${label} → ${updated[f]}`);

    // In-app notification for the member
    if (changes.length > 0 && oldMember.clerkUserId) {
      await Notification.create({
        type:        "MemberUpdate",
        content:     `Your profile was updated by admin: ${changes.join(", ")}.`,
        clerkUserId: oldMember.clerkUserId,
        adminOnly:   false,
      });
    }

    // Audit log — fire-and-forget
    writeAuditLog({
      action:      "MEMBER_UPDATED",
      performedBy: req.clerkUserId,
      targetId:    updated._id,
      description: `Admin updated member ${updated.name} (${updated.membershipNo})`,
      before:      beforeSnapshot,
      after:       afterSnapshot,
      metadata:    { changes },
    });

    return res.status(200).json({ success: true, member: updated });
  } catch (error) {
    console.error("updateMemberProfile error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── deleteMember ─────────────────────────────────────────────────────────────

export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByIdAndDelete(id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // Cascade: remove all financial and notification records
    await cascadeDeleteMember(id, member.clerkUserId);

    // Audit log — fire-and-forget
    writeAuditLog({
      action:      "MEMBER_DELETED",
      performedBy: req.clerkUserId,
      targetId:    member._id,
      description:
        `Admin deleted member ${member.name} (${member.membershipNo})`,
      before: {
        name:         member.name,
        email:        member.email,
        membershipNo: member.membershipNo,
        role:         member.role,
      },
      metadata: { cascadeDeleted: true },
    });

    return res.status(200).json({
      success: true,
      message: "Member and all related data deleted",
    });
  } catch (error) {
    console.error("deleteMember error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── approveAdmin ─────────────────────────────────────────────────────────────

export const approveAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const oldMember = await Member.findById(id);
    if (!oldMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const updated = await Member.findByIdAndUpdate(
      id,
      { $set: { role: "admin", pendingAdmin: false } },
      { new: true }
    );

    // Notify the newly approved admin
    if (updated.clerkUserId) {
      await Notification.create({
        type:        "AdminApproved",
        content:     "Congratulations! Your admin access request has been approved.",
        clerkUserId: updated.clerkUserId,
        adminOnly:   false,
      });
    }

    // Audit log — fire-and-forget
    writeAuditLog({
      action:      "MEMBER_ROLE_CHANGED",
      performedBy: req.clerkUserId,
      targetId:    updated._id,
      description:
        `Admin approved admin role for ${updated.name} (${updated.membershipNo})`,
      before: { role: oldMember.role, pendingAdmin: oldMember.pendingAdmin },
      after:  { role: "admin",        pendingAdmin: false },
    });

    return res.status(200).json({ success: true, member: updated });
  } catch (error) {
    console.error("approveAdmin error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};











// ─── rejectAdminRequest ────────────────────────────────────────────────────
// Admin declines a member's pending admin request.
// Sets pendingAdmin back to false — the member's role is untouched
// (they remain a regular "member"), and they are free to request again
// later if they choose to.
//
// reason is optional. When provided, it is shown to the member in their
// notification so they understand why the request was declined an
// whether re-requesting later makes sense.

export const rejectAdminRequest = async (req, res) => {
  try {
    const { id }     = req.params;
    const { reason } = req.body;

    const oldMember = await Member.findById(id);
    if (!oldMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    if (!oldMember.pendingAdmin) {
      return res.status(400).json({
        success: false,
        message:  "This member has no pending admin request",
      });
    }

    const updated = await Member.findByIdAndUpdate(
      id,
      { $set: { pendingAdmin: false } },
      { new: true }
    );

    // Notify the member — with or without a reason
    if (updated.clerkUserId) {
      const baseMessage = "Your admin access request was not approved.";
      const content = reason?.trim()
        ? `${baseMessage} Reason: ${reason.trim()}`
        : `${baseMessage} You may submit a new request at any time.`;

      await Notification.create({
        type:        "AdminRejected",
        content,
        clerkUserId: updated.clerkUserId,
        adminOnly:   false,
      });
    }

    // Audit log — same category as MEMBER_ROLE_CHANGED, since this is
    // a decision about role elevation even though the outcome is "no change"
    writeAuditLog({
      action:      "MEMBER_ROLE_CHANGED",
      performedBy: req.clerkUserId,
      targetId:    updated._id,
      description:
        `Admin rejected admin-access request from ${updated.name} ` +
        `(${updated.membershipNo})` + (reason?.trim() ? ` — ${reason.trim()}` : ""),
      before: { pendingAdmin: true,  role: oldMember.role },
      after:  { pendingAdmin: false, role: oldMember.role },
      metadata: { decision: "rejected", reason: reason?.trim() || null },
    });

    return res.status(200).json({ success: true, member: updated });
  } catch (error) {
    console.error("rejectAdminRequest error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};












// ── triggerMonthlyDue (dev/testing only) ─────────────────────────────────────

export const triggerMonthlyDue = async (req, res) => {
  // WHY this guard: this endpoint manually adds dues for all members.
  // In production it would be catastrophic if triggered accidentally or
  // by a confused admin. It only exists to let developers test the payment
  // flow without waiting for the 1st of the month.
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ success: false, message: "Not available in production" });
  }

  try {
    // Dynamically import to avoid circular dependency at module load time
    const { addMonthlyDueForAll } = await import("./paymentController.js");
    return addMonthlyDueForAll(req, res);
  } catch (error) {
    console.error("triggerMonthlyDue error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};