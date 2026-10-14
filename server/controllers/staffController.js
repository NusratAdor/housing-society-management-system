// server/controllers/staffController.js
//
// SECURITY NOTE — email-ownership verification on activation:
//   A pending invite matches on email. Activation only proceeds with Clerk's
//   VERIFIED primary email, so an attacker who registers a Clerk account with
//   someone else's email cannot hijack the invite.
//
// CHANGE (this pass): invite / activate / revoke are transactions with a
// REQUIRED audit. Revoke refuses to remove your own access or the last active
// Super Admin (guarded by a roster lock against two Super Admins revoking
// each other at once). Input is validated.

import { clerkClient } from "@clerk/express";
import StaffAccount from "../models/StaffAccount.js";
import Counter from "../models/Counter.js";
import { writeAuditLog } from "../services/auditService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { httpError } from "../utils/httpError.js";
import Member from "../models/Member.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID = /^[a-f\d]{24}$/i;

const sendError = (res, label, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ success: false, message: "Server error" });
};

const lockStaffRoster = (session) =>
  Counter.updateOne(
    { _id: "staff-roster-lock" },
    { $inc: { seq: 1 } },
    { upsert: true, session },
  );

// ─── getStaffProfile (GET /api/staff/me) ──────────────────────────────────

export const getStaffProfile = async (req, res) => {
  try {
    // A. Already active staff
    if (req.staff) {
      return res.status(200).json({
        success: true,
        staff: req.staff,
      });
    }

    // B. Get verified Clerk email
    const clerkUser = await clerkClient.users.getUser(req.clerkUserId);

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );

    if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
      return res.status(404).json({
        success: false,
        message: "Staff profile not found",
      });
    }

    const normalizedEmail = primaryEmail.emailAddress.toLowerCase();

    // C. Pending invitation matching this verified email
    //    This must be checked BEFORE revoked access so a revoked
    //    staff member can be legitimately re-invited.
    const activated = await runInTransactionWithRetry(async (session) => {
      const pending = await StaffAccount.findOne({
        email: normalizedEmail,
        clerkUserId: null,
        active: true,
      }).session(session);

      if (!pending) return null;

      pending.clerkUserId = req.clerkUserId;

      if (!pending.name && (clerkUser.firstName || clerkUser.lastName)) {
        pending.name =
          `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
      }

      await pending.save({ session });

      await writeAuditLog({
        action: "STAFF_ACTIVATED",
        performedBy: req.clerkUserId,
        targetId: pending._id,
        description: `Staff account activated for ${pending.email} (${pending.role})`,
        after: {
          clerkUserId: req.clerkUserId,
          role: pending.role,
        },
        session,
        required: true,
      });

      return pending;
    });

    if (activated) {
      return res.status(200).json({
        success: true,
        staff: activated,
      });
    }

    // D. No pending invitation.
    //    Check whether this Clerk account was previously revoked.
    const revokedStaff = await StaffAccount.findOne({
      clerkUserId: req.clerkUserId,
      active: false,
    }).select("-__v");

    if (revokedStaff) {
      return res.status(403).json({
        success: false,
        staff: null,
        accessRevoked: true,
        message:
          "Your staff access has been revoked. Please contact the Society office.",
      });
    }

    // E. Ordinary Clerk user
    return res.status(404).json({
      success: false,
      message: "Staff profile not found",
    });
  } catch (error) {
    return sendError(res, "getStaffProfile", error);
  }
};

// ─── inviteStaff (POST /api/super-admin/staff) — Super Admin only ─────────

export const inviteStaff = async (req, res) => {
  try {
    const { email, role, name } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    if (!["content_manager", "super_admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim().length > 100)) {
      return res.status(400).json({ success: false, message: "Invalid name" });
    }

    const staff = await runInTransactionWithRetry(async (session) => {
      const existing = await StaffAccount.findOne({ email: normalizedEmail, active: true }).session(session);
      if (existing) {
        throw httpError(400, "An active staff account already exists for this email");
      }


            // Staff and members are separate by design (a staff login never gets a
      // member dashboard). Refuse an email that already belongs to a member.
      if (await Member.exists({ email: normalizedEmail }).session(session)) {
        throw httpError(409, "This email belongs to a society member. Staff accounts need a separate email.");
      }

      const [created] = await StaffAccount.create(
        [
          {
            email: normalizedEmail,
            name: name?.trim(),
            role,
            assignedBy: req.clerkUserId,
            active: true,
          },
        ],
        { session },
      );

      await writeAuditLog({
        action: "STAFF_INVITED",
        performedBy: req.clerkUserId,
        targetId: created._id,
        description: `Super Admin invited ${normalizedEmail} as ${role}`,
        after: { email: normalizedEmail, role },
        session,
        required: true,
      });

      return created;
    });

    return res.status(201).json({ success: true, staff });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An active staff account already exists for this email",
      });
    }
    return sendError(res, "inviteStaff", error);
  }
};

// ─── getAllStaff (GET /api/super-admin/staff) — Super Admin only ──────────

export const getAllStaff = async (req, res) => {
  try {
    const staff = await StaffAccount.find({ active: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, staff });
  } catch (error) {
    return sendError(res, "getAllStaff", error);
  }
};

// ─── revokeStaff (DELETE /api/super-admin/staff/:id) — Super Admin only ───
// Soft-revoke only — history stays for audit.

export const revokeStaff = async (req, res) => {
  try {
    const { id } = req.params;

    if (!OBJECT_ID.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID" });
    }

    await runInTransactionWithRetry(async (session) => {
      await lockStaffRoster(session);

      const staff = await StaffAccount.findById(id).session(session);

      if (!staff) throw httpError(404, "Staff account not found");
      if (!staff.active) throw httpError(400, "Staff account already revoked");

      if (staff.clerkUserId && staff.clerkUserId === req.clerkUserId) {
        throw httpError(400, "You cannot revoke your own access.");
      }

      // A pending invite (no clerkUserId yet) cannot sign in, so it does not
      // count as a remaining Super Admin.
      if (staff.role === "super_admin" && staff.clerkUserId) {
        const remaining = await StaffAccount.countDocuments({
          _id: { $ne: staff._id },
          role: "super_admin",
          active: true,
          clerkUserId: { $type: "string" },
        }).session(session);

        if (remaining === 0) throw httpError(409, "Cannot revoke the last active Super Admin.");
      }

      staff.active = false;
      await staff.save({ session });

      await writeAuditLog({
        action: "STAFF_REVOKED",
        performedBy: req.clerkUserId,
        targetId: staff._id,
        description: `Super Admin revoked ${staff.email} (${staff.role})`,
        before: { active: true },
        after: { active: false },
        session,
        required: true,
      });
    });

    return res.status(200).json({ success: true, message: "Staff access revoked" });
  } catch (error) {
    return sendError(res, "revokeStaff", error);
  }
};