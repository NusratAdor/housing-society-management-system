// server/controllers/staffController.js
//
// SECURITY NOTE — email-ownership verification on activation:
//   A pending invite matches purely on email. If we linked clerkUserId
//   to ANY Clerk account merely claiming that email, an attacker who
//   registers a Clerk account with someone else's email could hijack
//   the invite before the real person signs in. To prevent this,
//   activation only proceeds using Clerk's VERIFIED primary email —
//   an address Clerk has confirmed the signed-in user actually
//   controls — never an unverified claim.

import { clerkClient } from "@clerk/express";
import StaffAccount from "../models/StaffAccount.js";
import { writeAuditLog } from "../services/auditService.js";

// ─── getStaffProfile (GET /api/staff/me) ──────────────────────────────────
// Returns the caller's StaffAccount. On first login after being invited,
// auto-links clerkUserId to a pending invite matching the verified
// primary email.

export const getStaffProfile = async (req, res) => {
  try {
    if (req.staff) {
      return res.status(200).json({ success: true, staff: req.staff });
    }

    const clerkUser = await clerkClient.users.getUser(req.clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    );

    if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
      return res.status(404).json({ success: false, message: "Staff profile not found" });
    }

    const pending = await StaffAccount.findOne({
      email: primaryEmail.emailAddress.toLowerCase(),
      clerkUserId: null,
      active: true,
    });

    if (!pending) {
      return res.status(404).json({ success: false, message: "Staff profile not found" });
    }

    pending.clerkUserId = req.clerkUserId;
    if (!pending.name && (clerkUser.firstName || clerkUser.lastName)) {
      pending.name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
    }
    await pending.save();

    writeAuditLog({
      action: "STAFF_ROLE_CHANGED",
      performedBy: "SYSTEM_STAFF_ACTIVATION",
      targetId: pending._id,
      description: `Staff account activated for ${pending.email} (${pending.role})`,
      after: { clerkUserId: req.clerkUserId, role: pending.role },
    });

    return res.status(200).json({ success: true, staff: pending });
  } catch (error) {
    console.error("getStaffProfile error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── inviteStaff (POST /api/super-admin/staff) — Super Admin only ─────────

export const inviteStaff = async (req, res) => {
  try {
    const { email, role, name } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const validRoles = ["content_manager", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await StaffAccount.findOne({ email: normalizedEmail, active: true });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An active staff account already exists for this email",
      });
    }

    const staff = await StaffAccount.create({
      email: normalizedEmail,
      name: name?.trim(),
      role,
      assignedBy: req.clerkUserId,
      active: true,
    });

    writeAuditLog({
      action: "STAFF_INVITED",
      performedBy: req.clerkUserId,
      targetId: staff._id,
      description: `Super Admin invited ${normalizedEmail} as ${role}`,
      after: { email: normalizedEmail, role },
    });

    return res.status(201).json({ success: true, staff });
  } catch (error) {
    // Handles the race-condition case the unique index guards against —
    // returns a clean message instead of a bare 500.
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An active staff account already exists for this email",
      });
    }
    console.error("inviteStaff error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── getAllStaff (GET /api/super-admin/staff) — Super Admin only ──────────

export const getAllStaff = async (req, res) => {
  try {
    const staff = await StaffAccount.find({ active: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, staff });
  } catch (error) {
    console.error("getAllStaff error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── revokeStaff (DELETE /api/super-admin/staff/:id) — Super Admin only ───
// Soft-revoke only — never hard-deletes, preserving history for audit.

export const revokeStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await StaffAccount.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff account not found" });
    }
    if (!staff.active) {
      return res.status(400).json({ success: false, message: "Staff account already revoked" });
    }

    staff.active = false;
    await staff.save();

    writeAuditLog({
      action: "STAFF_REVOKED",
      performedBy: req.clerkUserId,
      targetId: staff._id,
      description: `Super Admin revoked ${staff.email} (${staff.role})`,
      before: { active: true },
      after: { active: false },
    });

    return res.status(200).json({ success: true, message: "Staff access revoked" });
  } catch (error) {
    console.error("revokeStaff error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};