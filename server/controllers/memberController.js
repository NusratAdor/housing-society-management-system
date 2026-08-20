// server/controllers/memberController.js
//
// CHANGE (this pass): the old "Opening Balance as a partially-payable
// ExtraCharge" block is removed entirely. When a member claims a seat
// with a paidThroughMonth set, memberSeatService.generateBackdatedCharges
// creates real, correctly-dated MonthlyCharge records catching them up to
// the present month — no lump-sum figure, no partial-payment concept
// needed. Any one-off amount owed outside monthly dues is added
// afterward via the existing custom-charges admin feature, unchanged.

import Member        from "../models/Member.js";
import MemberSeat    from "../models/MemberSeat.js";
import {
  createOrUpdateMember,
  findMemberByClerkId,
  requestAdminAccess,
} from "../services/memberService.js";
import { generateBackdatedCharges } from "../services/memberSeatService.js";
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
       // ── Mark seat as claimed ──────────────────────────────────────────────
    // joinDate is set here automatically, to the exact registration
    // moment — never entered by admin, never in the CSV. This is the
    // one and only place joinDate gets written.
    if (!seat.isClaimed) {
      const now = new Date();
      seat.isClaimed        = true;
      seat.claimedByClerkId = clerkUserId;
      seat.claimedAt        = now;
      seat.joinDate          = now;
      await seat.save();
    }

    // ── Backfill historical monthly dues (first-time registration only) ──
    // If the seat has a paidThroughMonth set, catch the member up with
    // real, individually-dated MonthlyCharge records from the following
    // month through the current month. No-op if paidThroughMonth is unset.
    if (isFirstTimeCreate) {
      try {
        const result = await generateBackdatedCharges({
          memberId:         member._id,
          paidThroughMonth: seat.paidThroughMonth,
        });
        if (result.created > 0) {
          console.info(
            `[MemberSeat] Backfilled ${result.created} month(s) of dues for ${cleanMembership}`
          );
        }
      } catch (backfillError) {
        // Non-fatal — log but do not fail registration
        console.error("[MemberSeat] Backdated charge creation failed:", backfillError.message);
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
      .select("joinDate membershipNo")
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