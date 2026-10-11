// server/controllers/adminController.js
//
// Admin member management.
//
// CHANGE (this pass): every state change here is a transaction with a
// REQUIRED audit (profile update, admin approve/reject, demote); notifications
// are best-effort after commit. Approve/reject use an atomic conditional update.
// The nominee email regex now contains "@". Membership number and
// registeredPhone remain impossible to change through this endpoint.

import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { writeAuditLog } from "../services/auditService.js";
import { deactivateMember, lockAdminRoster } from "../services/memberService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { httpError } from "../utils/httpError.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";

const isValidEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const sendError = (res, label, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ success: false, message: "Server error" });
};

const notifyBestEffort = async (doc, label) => {
  try {
    await Notification.create(doc);
  } catch (error) {
    console.error(`${label} notification failed:`, error.message);
  }
};

// ─── getAllMembers ───────────────────────────────────────────────────────────

export const getAllMembers = async (req, res) => {
  try {
    const members = await Member.find().select(
      "name email phone membershipNo designation permanentAddress presentAddress plots nominee role pendingAdmin status clerkUserId profileImageUrl",
    );
    return res.status(200).json({ success: true, members });
  } catch (error) {
    return sendError(res, "getAllMembers", error);
  }
};

// ─── updateMemberProfile ─────────────────────────────────────────────────────

const PROTECTED_FIELDS = {
  membershipNo: "Membership number cannot be changed.",
  email: "Email cannot be changed through member profile editing.",
  clerkUserId: "Clerk user ID cannot be changed.",
  role: "Member role cannot be changed through member profile editing.",
  pendingAdmin: "Admin request status cannot be changed through member profile editing.",
  status: "Member status cannot be changed through member profile editing.",
  removedAt: "Removal information cannot be changed through member profile editing.",
  removedBy: "Removal information cannot be changed through member profile editing.",
  registeredPhone: "Registration phone number cannot be changed.",
};

const ALLOWED_PLOT_SIZES = [13, 10, 9, 7, 6.5];

const FIELD_LABELS = {
  name: "name",
  phone: "phone",
  designation: "designation",
  permanentAddress: "permanent address",
  presentAddress: "present address",
  plots: "plots",
  nominee: "nominee",
};

const requiredText = (value, message) =>
  value !== undefined && (typeof value !== "string" || !value.trim()) ? message : null;

const validatePlots = (plots) => {
  if (!Array.isArray(plots) || plots.length === 0) return "At least one plot is required";
  for (const plot of plots) {
    if (!plot || typeof plot !== "object") return "Invalid plot data";
    if (typeof plot.plotNo !== "string" || !plot.plotNo.trim()) return "Plot number is required";
    if (!ALLOWED_PLOT_SIZES.includes(Number(plot.plotSize))) return "Invalid plot size";
  }
  return null;
};

const validateNominee = (nominee) => {
  if (!nominee || typeof nominee !== "object") return "Invalid nominee data";
  if (typeof nominee.name !== "string" || !nominee.name.trim()) return "Nominee name is required";
  if (!nominee.phone || !isValidPhone(nominee.phone)) return "Invalid nominee phone number";
  if (!isValidEmail(nominee.email)) return "Invalid nominee email";
  return null;
};

const snapshot = (m) => ({
  name: m.name,
  phone: m.phone,
  designation: m.designation,
  permanentAddress: m.permanentAddress,
  presentAddress: m.presentAddress,
  membershipNo: m.membershipNo,
  plots: m.plots,
  nominee: m.nominee,
  role: m.role,
  pendingAdmin: m.pendingAdmin,
});

export const updateMemberProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    const blocked = Object.keys(PROTECTED_FIELDS).find((field) =>
      Object.prototype.hasOwnProperty.call(body, field),
    );
    if (blocked) {
      return res.status(400).json({ success: false, message: PROTECTED_FIELDS[blocked] });
    }

    const { name, phone, designation, permanentAddress, presentAddress, plots, nominee } = body;

    const validationError =
      requiredText(name, "Name is required") ||
      requiredText(designation, "Designation is required") ||
      requiredText(permanentAddress, "Permanent address is required") ||
      requiredText(presentAddress, "Present address is required") ||
      (phone !== undefined && !isValidPhone(phone) ? "Invalid phone number" : null) ||
      (plots !== undefined ? validatePlots(plots) : null) ||
      (nominee !== undefined ? validateNominee(nominee) : null);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const updateData = {
      ...(name !== undefined && { name: name.trim() }),
      ...(phone !== undefined && { phone: normalizePhone(phone) }),
      ...(designation !== undefined && { designation: designation.trim() }),
      ...(permanentAddress !== undefined && { permanentAddress: permanentAddress.trim() }),
      ...(presentAddress !== undefined && { presentAddress: presentAddress.trim() }),
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

    const { updated, changes, clerkUserId } = await runInTransactionWithRetry(
      async (session) => {
        const oldMember = await Member.findById(id).session(session);
        if (!oldMember) throw httpError(404, "Member not found");
        if (oldMember.status === "removed") {
          throw httpError(400, "Removed members cannot be edited");
        }

        const before = snapshot(oldMember.toObject());

        const updatedDoc = await Member.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true, session },
        );

        const after = snapshot(updatedDoc.toObject());

        const changed = Object.entries(FIELD_LABELS)
          .filter(
            ([field]) =>
              JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null),
          )
          .map(([, label]) => `${label} updated`);

        await writeAuditLog({
          action: "MEMBER_UPDATED",
          performedBy: req.clerkUserId,
          targetId: updatedDoc._id,
          description: `Admin updated member ${updatedDoc.name} (${updatedDoc.membershipNo})`,
          before,
          after,
          metadata: { changes: changed, membershipNoLocked: true },
          session,
          required: true,
        });

        return {
          updated: updatedDoc,
          changes: changed,
          clerkUserId: oldMember.clerkUserId,
        };
      },
    );

    if (changes.length > 0 && clerkUserId) {
      await notifyBestEffort(
        {
          type: "MemberUpdate",
          content: `Your profile was updated by admin: ${changes.join(", ")}.`,
          clerkUserId,
          adminOnly: false,
        },
        "Member update",
      );
    }

    return res.status(200).json({ success: true, member: updated });
  } catch (error) {
    return sendError(res, "updateMemberProfile", error);
  }
};

// ─── deleteMember ────────────────────────────────────────────────────────────

export const deleteMember = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    if (member.status === "removed") {
      return res.status(400).json({
        success: false,
        message: "This member has already been removed",
      });
    }

    await deactivateMember(member._id, member.membershipNo, req.clerkUserId);

    return res.status(200).json({
      success: true,
      message:
        "Member removed. The membership number is now permanently retired, and all historical records have been preserved.",
    });
  } catch (error) {
    return sendError(res, "deleteMember", error);
  }
};

// ─── approveAdmin / rejectAdminRequest ───────────────────────────────────────
// One atomic conditional update decides the outcome. If it matches nothing, a
// follow-up read only explains WHY (same messages as before).

const explainAdminRequestFailure = async (id, { removedMessage, expectRole }) => {
  const member = await Member.findById(id).select("status pendingAdmin role").lean();

  if (!member) return httpError(404, "Member not found");
  if (member.status === "removed") return httpError(400, removedMessage);
  if (!member.pendingAdmin) return httpError(400, "This member has no pending admin request");
  if (expectRole && member.role === "admin") {
    return httpError(400, "This member is already an admin");
  }
  return httpError(409, "This request was just processed. Please refresh.");
};

export const approveAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await runInTransactionWithRetry(async (session) => {
      const doc = await Member.findOneAndUpdate(
        { _id: id, status: "active", pendingAdmin: true, role: "member" },
        { $set: { role: "admin", pendingAdmin: false } },
        { new: true, runValidators: true, session },
      );

      if (!doc) return null;

      await writeAuditLog({
        action: "ADMIN_REQUEST_APPROVED",
        performedBy: req.clerkUserId,
        targetId: doc._id,
        description: `Admin approved admin access for ${doc.name} (${doc.membershipNo})`,
        before: { role: "member", pendingAdmin: true },
        after: { role: doc.role, pendingAdmin: doc.pendingAdmin },
        session,
        required: true,
      });

      return doc;
    });

    if (!updated) {
      throw await explainAdminRequestFailure(id, {
        removedMessage: "Removed members cannot be granted admin access",
        expectRole: true,
      });
    }

    if (updated.clerkUserId) {
      await notifyBestEffort(
        {
          type: "AdminApproved",
          content: "Congratulations! Your admin access request has been approved.",
          clerkUserId: updated.clerkUserId,
          adminOnly: false,
        },
        "Admin approved",
      );
    }

    return res.status(200).json({ success: true, member: updated });
  } catch (error) {
    return sendError(res, "approveAdmin", error);
  }
};

export const rejectAdminRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const rawReason = req.body?.reason;
    const reason = typeof rawReason === "string" ? rawReason.trim() : "";

    if (reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be 500 characters or less",
      });
    }

    const updated = await runInTransactionWithRetry(async (session) => {
      const doc = await Member.findOneAndUpdate(
        { _id: id, status: "active", pendingAdmin: true },
        { $set: { pendingAdmin: false } },
        { new: true, runValidators: true, session },
      );

      if (!doc) return null;

      await writeAuditLog({
        action: "ADMIN_REQUEST_REJECTED",
        performedBy: req.clerkUserId,
        targetId: doc._id,
        description: `Admin rejected admin-access request from ${doc.name} (${doc.membershipNo})`,
        before: { pendingAdmin: true, role: doc.role },
        after: { pendingAdmin: false, role: doc.role },
        metadata: { decision: "rejected", reason: reason || null },
        session,
        required: true,
      });

      return doc;
    });

    if (!updated) {
      throw await explainAdminRequestFailure(id, {
        removedMessage: "Removed members cannot have their admin request processed",
        expectRole: false,
      });
    }

    if (updated.clerkUserId) {
      const base = "Your admin access request was not approved.";
      await notifyBestEffort(
        {
          type: "AdminRejected",
          content: reason
            ? `${base} Reason: ${reason}`
            : `${base} You may submit a new request at any time.`,
          clerkUserId: updated.clerkUserId,
          adminOnly: false,
        },
        "Admin rejected",
      );
    }

    return res.status(200).json({ success: true, member: updated });
  } catch (error) {
    return sendError(res, "rejectAdminRequest", error);
  }
};

// ─── demoteMember ────────────────────────────────────────────────────────────
// Demotion is NOT removal: status, seat, membershipNo, plots, charges and
// payment history are untouched. Only role and pendingAdmin change.

export const demoteMember = async (req, res) => {
  try {
    const target = await runInTransactionWithRetry(async (session) => {
      await lockAdminRoster(session);

      const doc = await Member.findOne({
        _id: req.params.id,
        status: "active",
        role: "admin",
      }).session(session);

      if (!doc) throw httpError(404, "Active administrator not found");
      if (doc.clerkUserId === req.clerkUserId) {
        throw httpError(400, "You cannot demote yourself.");
      }

      const remainingAdminCount = await Member.countDocuments({
        _id: { $ne: doc._id },
        role: "admin",
        status: "active",
      }).session(session);

      if (remainingAdminCount === 0) {
        throw httpError(409, "Cannot demote the last active administrator.");
      }

      const before = { role: doc.role, pendingAdmin: doc.pendingAdmin };

      doc.role = "member";
      doc.pendingAdmin = false;
      await doc.save({ session });

      await writeAuditLog({
        action: "MEMBER_ROLE_CHANGED",
        performedBy: req.clerkUserId,
        targetId: doc._id,
        description: `Administrator access removed from ${doc.name} (${doc.membershipNo}).`,
        before,
        after: { role: doc.role, pendingAdmin: doc.pendingAdmin },
        metadata: { reason: "ADMIN_DEMOTION" },
        session,
        required: true,
      });

      return doc;
    });

    return res.status(200).json({
      success: true,
      message: "Administrator has been demoted to member.",
      member: { _id: target._id, role: target.role, pendingAdmin: target.pendingAdmin },
    });
  } catch (error) {
    return sendError(res, "demoteMember", error);
  }
};