// server/controllers/adminController.js
// Every state-changing operation now writes an AuditLog via writeAuditLog().
// The audit write is after the main operation and uses fire-and-forget
// so a log write failure never causes the operation to return an error.
//
// CHANGE (this pass): updateMemberProfile no longer accepts membershipNo
// at all — it is silently ignored even if sent in the request body. Once
// a member is registered, their membership number is the permanent key
// tying together Member, MemberSeat, MonthlyCharge, ExtraCharge, and
// Payment records; allowing it to change after the fact risks orphaning
// historical financial records or colliding with another member's
// number. This is enforced here, server-side, rather than relying on the
// admin UI alone to never send it — the UI should never offer to edit it
// (see ManageMembers.jsx), but this endpoint must reject/ignore it
// regardless of what any client sends.

import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { deactivateMember } from "../services/memberService.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";

const isValidEmail = (value) => /^[^\s@]+\.[^\s@]+$/.test(value.trim());
// ─── getAllMembers ─────────────────────────────────────────────────────────────

export const getAllMembers = async (req, res) => {
  try {
    const members = await Member.find().select(
      "name email phone membershipNo designation permanentAddress presentAddress plots nominee role pendingAdmin status clerkUserId profileImageUrl",
    );
    return res.status(200).json({ success: true, members });
  } catch (error) {
    console.error("getAllMembers error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── updateMemberProfile ──────────────────────────────────────────────────────

// ─── updateMemberProfile ──────────────────────────────────────────────────────

export const updateMemberProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const body = req.body ?? {};

    const protectedFields = {
      membershipNo: "Membership number cannot be changed.",
      email: "Email cannot be changed through member profile editing.",
      clerkUserId: "Clerk user ID cannot be changed.",
      role: "Member role cannot be changed through member profile editing.",
      pendingAdmin:
        "Admin request status cannot be changed through member profile editing.",
      status: "Member status cannot be changed through member profile editing.",
      removedAt:
        "Removal information cannot be changed through member profile editing.",
      removedBy:
        "Removal information cannot be changed through member profile editing.",
      registeredPhone: "Registration phone number cannot be changed.",
    };

    const attemptedProtectedField = Object.keys(protectedFields).find((field) =>
      Object.prototype.hasOwnProperty.call(body, field),
    );

    if (attemptedProtectedField) {
      return res.status(400).json({
        success: false,
        message: protectedFields[attemptedProtectedField],
      });
    }

    const {
      name,
      phone,
      designation,
      permanentAddress,
      presentAddress,
      plots,
      nominee,
    } = body;

    // ─────────────────────────────────────────────────────────────
    // Find member first
    // ─────────────────────────────────────────────────────────────

    const oldMember = await Member.findById(id);

    if (!oldMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (oldMember.status === "removed") {
      return res.status(400).json({
        success: false,
        message: "Removed members cannot be edited",
      });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (
      designation !== undefined &&
      (typeof designation !== "string" || !designation.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Designation is required",
      });
    }

    if (
      permanentAddress !== undefined &&
      (typeof permanentAddress !== "string" || !permanentAddress.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Permanent address is required",
      });
    }

    if (
      presentAddress !== undefined &&
      (typeof presentAddress !== "string" || !presentAddress.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Present address is required",
      });
    }
    // ─────────────────────────────────────────────────────────────
    // Validate phone if admin is changing it
    // ─────────────────────────────────────────────────────────────

    if (phone !== undefined && !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Validate plots
    // ─────────────────────────────────────────────────────────────

    if (plots !== undefined) {
      if (!Array.isArray(plots) || plots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one plot is required",
        });
      }

      const allowedPlotSizes = [13, 10, 9, 7, 6.5];

      for (const plot of plots) {
        if (!plot || typeof plot !== "object") {
          return res.status(400).json({
            success: false,
            message: "Invalid plot data",
          });
        }

        if (typeof plot.plotNo !== "string" || !plot.plotNo.trim()) {
          return res.status(400).json({
            success: false,
            message: "Plot number is required",
          });
        }

        if (!allowedPlotSizes.includes(Number(plot.plotSize))) {
          return res.status(400).json({
            success: false,
            message: "Invalid plot size",
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Validate nominee
    // ─────────────────────────────────────────────────────────────

    if (nominee !== undefined) {
      if (!nominee || typeof nominee !== "object") {
        return res.status(400).json({
          success: false,
          message: "Invalid nominee data",
        });
      }

      if (typeof nominee.name !== "string" || !nominee.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Nominee name is required",
        });
      }

      if (!nominee.phone || !isValidPhone(nominee.phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid nominee phone number",
        });
      }

      if (
        typeof nominee.email !== "string" ||
        !nominee.email.trim() ||
        !isValidEmail(nominee.email.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid nominee email",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Snapshot BEFORE state for audit
    // ─────────────────────────────────────────────────────────────

    const beforeSnapshot = {
      name: oldMember.name,
      phone: oldMember.phone,
      designation: oldMember.designation,

      permanentAddress: oldMember.permanentAddress,
      presentAddress: oldMember.presentAddress,

      membershipNo: oldMember.membershipNo,

      plots: oldMember.plots,
      nominee: oldMember.nominee,

      role: oldMember.role,
      pendingAdmin: oldMember.pendingAdmin,
    };

    // ─────────────────────────────────────────────────────────────
    // Build update object
    //
    // IMPORTANT:
    // membershipNo is deliberately NOT included.
    // email is also deliberately NOT included.
    // clerkUserId is never editable.
    // ─────────────────────────────────────────────────────────────

    const updateData = {
      ...(name !== undefined && {
        name: name.trim(),
      }),

      ...(phone !== undefined && {
        phone: normalizePhone(phone),
      }),

      ...(designation !== undefined && {
        designation: designation.trim(),
      }),

      ...(permanentAddress !== undefined && {
        permanentAddress: permanentAddress.trim(),
      }),

      ...(presentAddress !== undefined && {
        presentAddress: presentAddress.trim(),
      }),

      ...(plots !== undefined && {
        plots: plots.map((plot) => ({
          plotNo: plot.plotNo.trim().toUpperCase(),
          plotSize: Number(plot.plotSize),
        })),
      }),

      ...(nominee !== undefined && {
        nominee: {
          name: nominee.name.trim(),
          phone: normalizePhone(nominee.phone),
          email: nominee.email.trim().toLowerCase(),
        },
      }),
    };

    // ─────────────────────────────────────────────────────────────
    // Update member
    // ─────────────────────────────────────────────────────────────

    const updated = await Member.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Snapshot AFTER state for audit
    // ─────────────────────────────────────────────────────────────

    const afterSnapshot = {
      name: updated.name,
      phone: updated.phone,
      designation: updated.designation,

      permanentAddress: updated.permanentAddress,
      presentAddress: updated.presentAddress,

      membershipNo: updated.membershipNo,

      plots: updated.plots,
      nominee: updated.nominee,

      role: updated.role,
      pendingAdmin: updated.pendingAdmin,
    };

    // ─────────────────────────────────────────────────────────────
    // Detect changed fields
    // ─────────────────────────────────────────────────────────────
    const fieldLabels = {
      name: "name",
      phone: "phone",
      designation: "designation",
      permanentAddress: "permanent address",
      presentAddress: "present address",
      plots: "plots",
      nominee: "nominee",
    };

    const changes = Object.entries(fieldLabels)
      .filter(([field]) => {
        const before = JSON.stringify(oldMember[field] ?? null);
        const after = JSON.stringify(updated[field] ?? null);

        return before !== after;
      })
      .map(([field, label]) => `${label} updated`);

    // ─────────────────────────────────────────────────────────────
    // Notify member
    // ─────────────────────────────────────────────────────────────
    try {
      if (changes.length > 0 && oldMember.clerkUserId) {
        await Notification.create({
          type: "MemberUpdate",
          content: `Your profile was updated by admin: ${changes.join(", ")}.`,
          clerkUserId: oldMember.clerkUserId,
          adminOnly: false,
        });
      }
    } catch (notificationError) {
      console.error(
        "Member update notification failed:",
        notificationError.message,
      );
    }

    // ─────────────────────────────────────────────────────────────
    // Audit log
    // ─────────────────────────────────────────────────────────────

    writeAuditLog({
      action: "MEMBER_UPDATED",
      performedBy: req.clerkUserId,
      targetId: updated._id,
      description: `Admin updated member ${updated.name} (${updated.membershipNo})`,
      before: beforeSnapshot,
      after: afterSnapshot,
      metadata: {
        changes,
        membershipNoLocked: true,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      member: updated,
    });
  } catch (error) {
    console.error("updateMemberProfile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── deleteMember ─────────────────────────────────────────────────────────────

export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (member.status === "removed") {
      return res.status(400).json({
        success: false,
        message: "This member has already been removed",
      });
    }

    await deactivateMember(
      member._id,
      member.membershipNo,
      req.clerkUserId,
    );

    return res.status(200).json({
      success: true,
      message:
        "Member removed. The membership number is now permanently retired, and all historical records have been preserved.",
    });
  } catch (error) {
    console.error("deleteMember error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 409
          ? error.message
          : "Server error",
    });
  }
};

// ─── approveAdmin ─────────────────────────────────────────────────────────────

export const approveAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const oldMember = await Member.findById(id);

    if (!oldMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (oldMember.status === "removed") {
      return res.status(400).json({
        success: false,
        message: "Removed members cannot be granted admin access",
      });
    }

    if (!oldMember.pendingAdmin) {
      return res.status(400).json({
        success: false,
        message: "This member has no pending admin request",
      });
    }

    if (oldMember.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "This member is already an admin",
      });
    }

    const updated = await Member.findByIdAndUpdate(
      id,
      {
        $set: {
          role: "admin",
          pendingAdmin: false,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (updated.clerkUserId) {
      await Notification.create({
        type: "AdminApproved",
        content:
          "Congratulations! Your admin access request has been approved.",
        clerkUserId: updated.clerkUserId,
        adminOnly: false,
      });
    }

    writeAuditLog({
      action: "ADMIN_REQUEST_APPROVED",
      performedBy: req.clerkUserId,
      targetId: updated._id,
      description:
        `Admin approved admin access for ${updated.name} ` +
        `(${updated.membershipNo})`,
      before: {
        role: oldMember.role,
        pendingAdmin: oldMember.pendingAdmin,
      },
      after: {
        role: updated.role,
        pendingAdmin: updated.pendingAdmin,
      },
    });

    return res.status(200).json({
      success: true,
      member: updated,
    });
  } catch (error) {
    console.error("approveAdmin error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── rejectAdminRequest ────────────────────────────────────────────────────

export const rejectAdminRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const rawReason = req.body?.reason;

    const normalizedReason =
      typeof rawReason === "string" ? rawReason.trim() : "";

    if (normalizedReason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be 500 characters or less",
      });
    }

    const oldMember = await Member.findById(id);

    if (!oldMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (oldMember.status === "removed") {
      return res.status(400).json({
        success: false,
        message: "Removed members cannot have their admin request processed",
      });
    }

    if (!oldMember.pendingAdmin) {
      return res.status(400).json({
        success: false,
        message: "This member has no pending admin request",
      });
    }

    const updated = await Member.findByIdAndUpdate(
      id,
      {
        $set: {
          pendingAdmin: false,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (updated.clerkUserId) {
      const baseMessage = "Your admin access request was not approved.";

      const content = normalizedReason
        ? `${baseMessage} Reason: ${normalizedReason}`
        : `${baseMessage} You may submit a new request at any time.`;

      await Notification.create({
        type: "AdminRejected",
        content,
        clerkUserId: updated.clerkUserId,
        adminOnly: false,
      });
    }

    writeAuditLog({
      action: "ADMIN_REQUEST_REJECTED",
      performedBy: req.clerkUserId,
      targetId: updated._id,
      description:
        `Admin rejected admin-access request from ` +
        `${updated.name} (${updated.membershipNo})`,
      before: {
        pendingAdmin: true,
        role: oldMember.role,
      },
      after: {
        pendingAdmin: false,
        role: updated.role,
      },
      metadata: {
        decision: "rejected",
        reason: normalizedReason || null,
      },
    });

    return res.status(200).json({
      success: true,
      member: updated,
    });
  } catch (error) {
    console.error("rejectAdminRequest error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};





export const demoteMember = async (req, res) => {
  const session = await Member.startSession();

  try {
    session.startTransaction();

    const target = await Member.findOne({
      _id: req.params.id,
      status: "active",
      role: "admin",
    }).session(session);

    if (!target) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Active administrator not found",
      });
    }

    if (target.clerkUserId === req.clerkUserId) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "You cannot demote yourself.",
      });
    }

    const remainingAdminCount = await Member.countDocuments({
      _id: { $ne: target._id },
      role: "admin",
      status: "active",
    }).session(session);

    if (remainingAdminCount === 0) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message:
          "Cannot demote the last active administrator.",
      });
    }

    const before = {
      role: target.role,
      pendingAdmin: target.pendingAdmin,
    };

    target.role = "member";
    target.pendingAdmin = false;

    await target.save({ session });

    await writeAuditLog({
      action: "MEMBER_ROLE_CHANGED",
      performedBy: req.clerkUserId,
      targetId: target._id,
      description:
        `Administrator access removed from ${target.name} (${target.membershipNo}).`,
      before,
      after: {
        role: target.role,
        pendingAdmin: target.pendingAdmin,
      },
      metadata: {
        reason: "ADMIN_DEMOTION",
      },
      session,
      required: true,
    });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Administrator has been demoted to member.",
      member: {
        _id: target._id,
        role: target.role,
        pendingAdmin: target.pendingAdmin,
      },
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("demoteMember error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 409
          ? error.message
          : "Failed to demote administrator.",
    });
  } finally {
    await session.endSession();
  }
};

// ── triggerMonthlyDue (dev/testing only) ─────────────────────────────────────

export const triggerMonthlyDue = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json({ success: false, message: "Not available in production" });
  }

  try {
    const { addMonthlyDueForAll } = await import("./paymentController.js");
    return addMonthlyDueForAll(req, res);
  } catch (error) {
    console.error("triggerMonthlyDue error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
