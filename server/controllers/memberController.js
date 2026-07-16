// server/controllers/memberController.js
//
// CHANGE: when a member claims their seat, if the seat has an
// openingBalance > 0, a single MonthlyCharge record is created
// with type "Opening Balance" representing all historical dues.
// This integrates with the existing payment system — no new models,
// no new payment flow needed.

import Member        from "../models/Member.js";
import MemberSeat    from "../models/MemberSeat.js";
import MonthlyCharge from "../models/MonthlyCharge.js";
import {
  createOrUpdateMember,
  findMemberByClerkId,
  requestAdminAccess,
} from "../services/memberService.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";

// ── createMemberProfile ───────────────────────────────────────────────────────

export const createMemberProfile = async (req, res) => {
  try {
    const { name, email, phone, address, designation, membershipNo, plotNo } = req.body;
    const { clerkUserId } = req;

    if (!clerkUserId) return res.status(400).json({ success: false, message: "User ID missing" });
    if (!email)       return res.status(400).json({ success: false, message: "Email required" });

    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: "Invalid Bangladeshi phone number" });
    }
    const normalizedPhone = normalizePhone(phone);

    const cleanMembership = membershipNo?.trim().toUpperCase();
    if (!cleanMembership) {
      return res.status(400).json({ success: false, message: "Membership number is required" });
    }

    // ── MemberSeat validation ─────────────────────────────────────────────
    const seat = await MemberSeat.findOne({ membershipNo: cleanMembership });

    if (!seat) {
      return res.status(400).json({
        success: false,
        message: "Membership number not found. Please contact the admin to verify your membership.",
      });
    }

    if (seat.isClaimed && seat.claimedByClerkId !== clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "This membership number has already been registered. Contact admin if this is an error.",
      });
    }

    const existingMembership = await Member.findOne({ membershipNo: cleanMembership });
    if (existingMembership && existingMembership.clerkUserId !== clerkUserId) {
      return res.status(400).json({ success: false, message: "Membership number already in use" });
    }

    const existingMember    = await findMemberByClerkId(clerkUserId);
    const isFirstTimeCreate = !existingMember;

    const member = await createOrUpdateMember(clerkUserId, {
      name:         name?.trim(),
      email:        email.trim().toLowerCase(),
      phone:        normalizedPhone,
      address:      address?.trim(),
      designation:  designation?.trim(),
      membershipNo: cleanMembership,
      plotNo:       plotNo?.trim(),
      role:         existingMember?.role || "member",
    });

    // ── Mark seat as claimed ──────────────────────────────────────────────
    if (!seat.isClaimed) {
      seat.isClaimed        = true;
      seat.claimedByClerkId = clerkUserId;
      seat.claimedAt        = new Date();
      await seat.save();
    }

    // ── Apply opening balance (first-time registration only) ──────────────
    // If the CSV import set an openingBalance > 0, create a single
    // MonthlyCharge record to represent all historical dues.
    // Using month: 0, year: 0 as a sentinel to identify opening balance
    // charges distinctly from regular monthly charges.
    if (isFirstTimeCreate && seat.openingBalance > 0) {
      try {
        const alreadyExists = await MonthlyCharge.findOne({
          member: member._id,
          label:  "Opening Balance",
        });

        if (!alreadyExists) {
          await MonthlyCharge.create({
            member: member._id,
            month:  0,           // sentinel — not a real month
            year:   0,           // sentinel — not a real year
            amount: seat.openingBalance,
            status: "Unpaid",
            label:  "Opening Balance",
          });
          console.info(
            `[MemberSeat] Opening balance ৳${seat.openingBalance} created for ${cleanMembership}`
          );
        }
      } catch (balanceError) {
        // Non-fatal — log but do not fail registration
        console.error("[MemberSeat] Opening balance creation failed:", balanceError.message);
      }
    }

    return res.status(isFirstTimeCreate ? 201 : 200).json({
      success: true,
      message: isFirstTimeCreate ? "Profile created" : "Profile updated",
      member,
    });
  } catch (error) {
    console.error("createMemberProfile error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── getMemberProfile ──────────────────────────────────────────────────────────

export const getMemberProfile = async (req, res) => {
  try {
    const member = await findMemberByClerkId(req.clerkUserId);
    if (!member) return res.status(404).json({ success: false, message: "Profile not found" });
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
    if (!member) return res.status(404).json({ success: false, message: "Member not found" });

    const seat = await MemberSeat.findOne({ membershipNo: member.membershipNo })
      .select("joinDate membershipNo openingBalance")
      .lean();

    return res.status(200).json({ success: true, joinDate: seat?.joinDate ?? null });
  } catch (error) {
    console.error("getMemberSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── requestAdmin ──────────────────────────────────────────────────────────────

export const requestAdmin = async (req, res) => {
  try {
    const member = await requestAdminAccess(req.clerkUserId);
    return res.status(200).json({ success: true, message: "Admin request submitted", member });
  } catch (error) {
    const isBusinessError = ["Profile not found","already an admin","already pending"]
      .some(msg => error.message.includes(msg));
    return res.status(isBusinessError ? 400 : 500).json({ success: false, message: error.message });
  }
};