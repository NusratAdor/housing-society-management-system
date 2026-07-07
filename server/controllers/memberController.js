// server/controllers/memberController.js
// Handles member self-service: create profile, get own profile, request admin.
// Phone normalization imported from shared utility — not duplicated here.

import Member from "../models/Member.js";
import { createOrUpdateMember, findMemberByClerkId, requestAdminAccess } from "../services/memberService.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";

// ── createMemberProfile ───────────────────────────────────────────────────────

export const createMemberProfile = async (req, res) => {
  try {
    const { name, email, phone, address, designation, membershipNo, plotNo } = req.body;
    const { clerkUserId } = req;

    if (!clerkUserId) return res.status(400).json({ success: false, message: "User ID missing" });
    if (!email)       return res.status(400).json({ success: false, message: "Email required" });

    // Validate and normalise phone using shared utility
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: "Invalid Bangladeshi phone number" });
    }
    const normalizedPhone = normalizePhone(phone);

    const cleanMembership = membershipNo?.trim().toUpperCase();
    if (!cleanMembership || !/^[A-Za-z0-9-]+$/.test(cleanMembership)) {
      return res.status(400).json({ success: false, message: "Invalid membership number format" });
    }

    // Block duplicate membership numbers from other users
    const existingMembership = await Member.findOne({ membershipNo: cleanMembership });
    if (existingMembership && existingMembership.clerkUserId !== clerkUserId) {
      return res.status(400).json({ success: false, message: "Membership number already in use" });
    }

    const existingMember = await findMemberByClerkId(clerkUserId);

    const memberData = {
      name:         name?.trim(),
      email:        email.trim().toLowerCase(),
      phone:        normalizedPhone,
      address:      address?.trim(),
      designation:  designation?.trim(),
      membershipNo: cleanMembership,
      plotNo:       plotNo?.trim(),
      // Preserve existing role if updating — never downgrade an admin to member
      role: existingMember?.role || "member",
    };

    const member = await createOrUpdateMember(clerkUserId, memberData);

    return res.status(existingMember ? 200 : 201).json({
      success: true,
      message: existingMember ? "Profile updated" : "Profile created",
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
    const { clerkUserId } = req;
    if (!clerkUserId) return res.status(400).json({ success: false, message: "User ID missing" });

    // WHY the ADMIN_CLERK_ID fallback was removed:
    // The original returned a fake hardcoded member object for the env admin.
    // This fake object had no _id, no Mongoose methods, and no real DB record.
    // Any downstream code that called .save() or read ._id on it would fail.
    // The correct approach is that the admin has a real Member document with
    // role:"admin" — created once by setting it directly in MongoDB Atlas.
    const member = await findMemberByClerkId(clerkUserId);
    if (!member) return res.status(404).json({ success: false, message: "Profile not found" });

    return res.status(200).json({ success: true, member });
  } catch (error) {
    console.error("getMemberProfile error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── requestAdmin ──────────────────────────────────────────────────────────────

export const requestAdmin = async (req, res) => {
  try {
    const { clerkUserId } = req;
    if (!clerkUserId) return res.status(400).json({ success: false, message: "User ID missing" });

    const member = await requestAdminAccess(clerkUserId);
    return res.status(200).json({ success: true, message: "Admin request submitted", member });
  } catch (error) {
    console.error("requestAdmin error:", error.message);

    // WHY separate status codes:
    // The original returned 400 for ALL errors including unexpected DB errors.
    // A DB connection failure is not a bad request — it is a server error.
    // Known business logic errors (already admin, already pending, not found)
    // legitimately return 400. Unexpected errors return 500.
    const isBusinessError = [
      "Profile not found",
      "already an admin",
      "already pending",
    ].some((msg) => error.message.includes(msg));

    return res.status(isBusinessError ? 400 : 500).json({
      success: false,
      message: error.message,
    });
  }
};







// GET /api/members/seat
// Returns the MemberSeat record for the authenticated member.
// Used by the dashboard to show the correct "Member since" join date.
// This is the date from physical society records, not the digital signup date.

import MemberSeat from "../models/MemberSeat.js";

export const getMemberSeat = async (req, res) => {
  try {
    const member = await findMemberByClerkId(req.clerkUserId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const seat = await MemberSeat.findOne({
      membershipNo: member.membershipNo,
    }).select("joinDate membershipNo").lean();

    if (!seat) {
      // Member exists but seat record not found (pre-seat-system members)
      // Return success with null joinDate — frontend falls back to createdAt
      return res.status(200).json({ success: true, joinDate: null });
    }

    return res.status(200).json({ success: true, joinDate: seat.joinDate });
  } catch (error) {
    console.error("getMemberSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};