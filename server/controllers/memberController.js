// server/controllers/memberController.js
//
// CHANGE (this pass): the old "Opening Balance as a partially-payable
// ExtraCharge" block is removed entirely. When a member claims a seat
// with a paidThroughMonth set, memberSeatService.generateBackdatedCharges
// creates real, correctly-dated MonthlyCharge records catching them up to
// the present month — no lump-sum figure, no partial-payment concept
// needed. Any one-off amount owed outside monthly dues is added
// afterward via the existing custom-charges admin feature, unchanged.

import Member from "../models/Member.js";
import MemberSeat from "../models/MemberSeat.js";
import mongoose from "mongoose";
import {
  updateOwnMemberProfile,
  findMemberByClerkId,
  requestAdminAccess,
} from "../services/memberService.js";
import { generateBackdatedCharges } from "../services/memberSeatService.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";
import { clerkClient } from "@clerk/express";
import { writeAuditLog } from "../services/auditService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { httpError } from "../utils/httpError.js";

// ── createMemberProfile ───────────────────────────────────────────────────────

// ── createMemberProfile ───────────────────────────────────────────────────────

export const createMemberProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      designation,
      permanentAddress,
      presentAddress,
      membershipNo,
      plots,
      nominee,
    } = req.body; // email is deliberately NOT read: it comes from Clerk below

    const { clerkUserId } = req;

    // ── Basic request validation (no database yet) ──────────────────────
    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    let normalizedPhone = null;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      normalizedPhone = null;
    }
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: "Invalid phone number" });
    }

    const cleanMembership = membershipNo?.trim().toUpperCase();
    if (!cleanMembership) {
      return res.status(400).json({ success: false, message: "Membership number is required" });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!designation?.trim()) {
      return res.status(400).json({ success: false, message: "Designation is required" });
    }
    if (!permanentAddress?.trim()) {
      return res.status(400).json({ success: false, message: "Permanent address is required" });
    }
    if (!presentAddress?.trim()) {
      return res.status(400).json({ success: false, message: "Present address is required" });
    }

    if (!Array.isArray(plots) || plots.length === 0) {
      return res.status(400).json({ success: false, message: "At least one plot is required" });
    }

    const allowedPlotSizes = [13, 10, 9, 7, 6.5];
    const normalizedPlots = plots.map((plot) => ({
      plotNo: plot?.plotNo?.trim().toUpperCase(),
      plotSize: Number(plot?.plotSize),
    }));

    if (normalizedPlots.some((p) => !p.plotNo || !allowedPlotSizes.includes(p.plotSize))) {
      return res.status(400).json({
        success: false,
        message: "Each plot must have a valid plot number and plot size",
      });
    }

    if (
      !nominee?.name?.trim() ||
      !nominee?.email?.trim() ||
      !isValidPhone(nominee.phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid nominee information is required",
      });
    }

    const normalizedNomineePhone = normalizePhone(nominee.phone);
    if (!normalizedNomineePhone) {
      return res.status(400).json({ success: false, message: "Invalid nominee phone number" });
    }

    // ── Email comes from Clerk (verified), never from the request body ──
    // Network call, so it runs OUTSIDE the transaction.
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );

    if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
      return res.status(400).json({
        success: false,
        message: "Please verify your email address before registering.",
      });
    }
    const verifiedEmail = primaryEmail.emailAddress.trim().toLowerCase();

    // ── One transaction: member + seat claim + backdated charges + audit ──
    // The callback may run again after a transient conflict, so it must hold
    // only database work.
    const member = await runInTransactionWithRetry(async (session) => {
      const existingMember = await Member.findOne({ clerkUserId }).session(session);

      // A removed member must never be silently resurrected.
      if (existingMember) {
        throw httpError(
          409,
          existingMember.status === "removed"
            ? "This account has been removed. Please contact the admin."
            : "Profile already exists. Please use your profile page to make changes.",
        );
      }

      // membershipNo alone is NOT enough: both it and the registered phone
      // must match the admin-provisioned seat.
      const seat = await MemberSeat.findOne({
        membershipNo: cleanMembership,
        registeredPhone: normalizedPhone,
        isRetired: false,
      }).session(session);

      if (!seat) {
        throw httpError(
          400,
          "Membership number and registered phone number do not match our records. Please contact the admin.",
        );
      }

      if (seat.isClaimed && seat.claimedByClerkId !== clerkUserId) {
        throw httpError(
          400,
          "This membership number has already been registered. Contact admin if this is an error.",
        );
      }

      const existingMembership = await Member.findOne({
        membershipNo: cleanMembership,
      }).session(session);

      if (existingMembership && existingMembership.clerkUserId !== clerkUserId) {
        throw httpError(400, "Membership number already in use");
      }

      const [created] = await Member.create(
        [
          {
            clerkUserId,
            name: name.trim(),
            email: verifiedEmail,
            profileImageUrl: clerkUser.hasImage ? clerkUser.imageUrl : null, 
            phone: normalizedPhone,
            designation: designation.trim(),
            permanentAddress: permanentAddress.trim(),
            presentAddress: presentAddress.trim(),
            membershipNo: cleanMembership,
            plots: normalizedPlots,
            nominee: {
              name: nominee.name.trim(),
              phone: normalizedNomineePhone,
              email: nominee.email.trim().toLowerCase(),
            },
            role: "member",
            pendingAdmin: false,
            status: "active",
          },
        ],
        { session },
      );

      // Atomic claim: only succeeds if the seat is still unclaimed.
      const now = new Date();
      const claimedSeat = await MemberSeat.findOneAndUpdate(
        { _id: seat._id, isClaimed: false, isRetired: false },
        {
          $set: {
            isClaimed: true,
            claimedByClerkId: clerkUserId,
            claimedAt: now,
            joinDate: now,
          },
        },
        { new: true, session },
      );

      if (!claimedSeat) {
        throw httpError(
          409,
          "This membership seat was claimed by another request. Please try again.",
        );
      }

      // seat.paidThroughMonth stays untouched: historical provisioning data.
      const backfill = await generateBackdatedCharges({
        memberId: created._id,
        paidThroughMonth: seat.paidThroughMonth,
        session,
      });

      // The registered phone is a credential, so it is NOT written to the audit log.
      await writeAuditLog({
        action: "MEMBER_REGISTERED",
        performedBy: clerkUserId,
        targetId: created._id,
        description: `Member ${created.name} (${cleanMembership}) registered and claimed their seat`,
        after: { membershipNo: cleanMembership, status: "active" },
        metadata: {
          paidThroughMonth: seat.paidThroughMonth,
          backdatedMonths: backfill.created,
        },
        session,
        required: true,
      });

      return created;
    });

    return res.status(201).json({ success: true, message: "Profile created", member });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email or membership number already exists.",
      });
    }
    console.error("createMemberProfile error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateOwnProfile = async (req, res) => {
  try {
    const { clerkUserId } = req;

    const {
      name,
      designation,
      permanentAddress,
      presentAddress,
      plots,
      nominee,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!designation?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Designation is required",
      });
    }

    if (!permanentAddress?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Permanent address is required",
      });
    }

    if (!presentAddress?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Present address is required",
      });
    }

    if (!Array.isArray(plots) || plots.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one plot is required",
      });
    }

    if (!nominee?.name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nominee name is required",
      });
    }

    const normalizedNomineePhone = normalizePhone(nominee.phone);

    if (!normalizedNomineePhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid nominee phone number",
      });
    }

    if (!nominee.email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nominee email is required",
      });
    }

    const allowedPlotSizes = new Set([13, 10, 9, 7, 6.5]);

    const normalizedPlots = plots.map((plot) => ({
      plotNo: String(plot.plotNo || "")
        .trim()
        .toUpperCase(),
      plotSize: Number(plot.plotSize),
    }));

    for (const plot of normalizedPlots) {
      if (!plot.plotNo) {
        return res.status(400).json({
          success: false,
          message: "Every plot must have a plot number",
        });
      }

      if (!allowedPlotSizes.has(plot.plotSize)) {
        return res.status(400).json({
          success: false,
          message: "Invalid plot size",
        });
      }
    }

    const updatedMember = await updateOwnMemberProfile(clerkUserId, {
      name: name.trim(),
      designation: designation.trim(),
      permanentAddress: permanentAddress.trim(),
      presentAddress: presentAddress.trim(),

      plots: normalizedPlots,

      nominee: {
        name: nominee.name.trim(),
        phone: normalizedNomineePhone,
        email: nominee.email.trim().toLowerCase(),
      },
    });

    if (!updatedMember) {
      return res.status(404).json({
        success: false,
        message: "Active member profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      member: updatedMember,
    });
  } catch (error) {
    console.error("updateOwnProfile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── getMemberProfile ──────────────────────────────────────────────────────────

export const getMemberProfile = async (req, res) => {
  try {
    const member = await findMemberByClerkId(req.clerkUserId);
    if (!member)
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    return res.status(200).json({ success: true, member });
  } catch (error) {
    console.error("getMemberProfile error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── getMemberSeat ─────────────────────────────────────────────────────────────

export const getMemberSeat = async (req, res) => {
  try {
    const member = await findMemberByClerkId(req.clerkUserId);
    if (!member)
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });

    const seat = await MemberSeat.findOne({ membershipNo: member.membershipNo })
      .select("joinDate membershipNo")
      .lean();

    return res
      .status(200)
      .json({ success: true, joinDate: seat?.joinDate ?? null });
  } catch (error) {
    console.error("getMemberSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── requestAdmin ──────────────────────────────────────────────────────────────

export const requestAdmin = async (req, res) => {
  try {
    const member = await requestAdminAccess(req.clerkUserId);
    return res
      .status(200)
      .json({ success: true, message: "Admin request submitted", member });
  } catch (error) {
    const isBusinessError = [
      "Profile not found",
      "already an admin",
      "already pending",
    ].some((msg) => error.message.includes(msg));
    return res
      .status(isBusinessError ? 400 : 500)
      .json({ success: false, message: error.message });
  }
};
