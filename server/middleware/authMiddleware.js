// server/middleware/authMiddleware.js
// CHANGE: protect now also attaches req.staff (active StaffAccount, if
// any) alongside the existing req.member lookup. Fully independent
// queries — a person can be a Member, staff, both, or neither, and this
// change does not alter existing req.member behavior in any way.

import Member from "../models/Member.js";
import StaffAccount from "../models/StaffAccount.js";

export const protect = async (req, res, next) => {
  try {
    const userId = req.auth()?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.clerkUserId = userId;

    // Unchanged from before.
    const member = await Member.findOne({ clerkUserId: userId }).select("-__v");
    if (member) req.member = member;

    // NEW — independent lookup, does not affect req.member above.
    const staff = await StaffAccount
      .findOne({ clerkUserId: userId, active: true })
      .select("-__v");
    if (staff) req.staff = staff;

    next();
  } catch (error) {
    console.error("protect middleware error:", error.message);
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }
};