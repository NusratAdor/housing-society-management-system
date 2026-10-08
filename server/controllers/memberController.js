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

// ── createMemberProfile ───────────────────────────────────────────────────────

// ── createMemberProfile ───────────────────────────────────────────────────────

export const createMemberProfile = async (req, res) => {
  const session = await Member.startSession();

  try {
    const {
      name,
      email,
      phone,
      designation,
      permanentAddress,
      presentAddress,
      membershipNo,
      plots,
      nominee,
    } = req.body;

    const { clerkUserId } = req;

    // ── Basic request validation ────────────────────────────────────────────

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID missing",
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    const cleanMembership = membershipNo?.trim().toUpperCase();

    if (!cleanMembership) {
      return res.status(400).json({
        success: false,
        message: "Membership number is required",
      });
    }

    // ── Validate new profile structure ─────────────────────────────────────

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

    const allowedPlotSizes = [13, 10, 9, 7, 6.5];

    const normalizedPlots = plots.map((plot) => ({
      plotNo: plot?.plotNo?.trim().toUpperCase(),
      plotSize: Number(plot?.plotSize),
    }));

    const invalidPlot = normalizedPlots.some(
      (plot) => !plot.plotNo || !allowedPlotSizes.includes(plot.plotSize),
    );

    if (invalidPlot) {
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
      return res.status(400).json({
        success: false,
        message: "Invalid nominee phone number",
      });
    }

    // ── Start transaction ──────────────────────────────────────────────────

    await session.startTransaction();

    // ── Find existing member ───────────────────────────────────────────────

    const existingMember = await Member.findOne({
      clerkUserId,
    }).session(session);

    // A removed member must never be silently resurrected.
    if (existingMember) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message:
          existingMember.status === "removed"
            ? "This account has been removed. Please contact the admin."
            : "Profile already exists. Please use your profile page to make changes.",
      });
    }

    // ── Find registration seat ─────────────────────────────────────────────
    //
    // IMPORTANT:
    // membershipNo alone is NOT enough.
    //
    // The member must prove that both:
    //
    //   membershipNo + registeredPhone
    //
    // match the admin-provisioned MemberSeat.

    const seat = await MemberSeat.findOne({
      membershipNo: cleanMembership,
      registeredPhone: normalizedPhone,
      isRetired: false,
    }).session(session);

    if (!seat) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "Membership number and registered phone number do not match our records. Please contact the admin.",
      });
    }

    // ── Check seat ownership ───────────────────────────────────────────────

    if (seat.isClaimed && seat.claimedByClerkId !== clerkUserId) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "This membership number has already been registered. Contact admin if this is an error.",
      });
    }

    // ── Check membership ownership ─────────────────────────────────────────

    const existingMembership = await Member.findOne({
      membershipNo: cleanMembership,
    }).session(session);

    if (existingMembership && existingMembership.clerkUserId !== clerkUserId) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Membership number already in use",
      });
    }

    // ---------------------------------------------------------
    // Create member
    // ---------------------------------------------------------

    const [member] = await Member.create(
      [
        {
          clerkUserId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
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

    // ---------------------------------------------------------
    // Atomically claim the seat
    // ---------------------------------------------------------

    const now = new Date();

    const claimedSeat = await MemberSeat.findOneAndUpdate(
      {
        _id: seat._id,
        isClaimed: false,
        isRetired: false,
      },
      {
        $set: {
          isClaimed: true,
          claimedByClerkId: clerkUserId,
          claimedAt: now,
          joinDate: now,
        },
      },
      {
        new: true,
        session,
      },
    );

    if (!claimedSeat) {
      throw new Error(
        "This membership seat was claimed by another request. Please try again.",
      );
    }

    // ---------------------------------------------------------
    // Generate historical monthly charges
    // ---------------------------------------------------------

    const result = await generateBackdatedCharges({
      memberId: member._id,
      paidThroughMonth: seat.paidThroughMonth,
      session,
    });

    if (result.created > 0) {
      console.info(
        `[MemberSeat] Backfilled ${result.created} month(s) for ${cleanMembership}`,
      );
    }

    // IMPORTANT:
    // Do NOT clear seat.paidThroughMonth.
    // It remains historical provisioning/audit information.

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Profile created",
      member,
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("createMemberProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    await session.endSession();
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
