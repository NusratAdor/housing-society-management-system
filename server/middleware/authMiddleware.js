// server/middleware/authMiddleware.js
// Reads the Clerk userId from req.auth (populated by clerkMiddleware from
// @clerk/express). Attaches the Member document to req.member if a profile
// exists. Does NOT block the request — that is the job of isAdmin or
// route-level guards. Every authenticated route runs this first.

import Member from "../models/Member.js";

export const protect = async (req, res, next) => {
  try {
    // WHY: The original code had a typeof req.auth === "function" check
    // inherited from @clerk/express v1 where req.auth() had to be called
    // as a function. In v2+ req.auth is a plain object set by clerkMiddleware.
    // Keeping the function check is dead code that misleads future developers
    // into thinking both APIs are still supported. Removed.
    const userId = req.auth()?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.clerkUserId = userId;

    // Attach member document if a profile exists.
    // Some routes (e.g. /create-profile) are called by signed-in users
    // who do not yet have a Member document, so a missing member is not
    // an error here — the controller handles that case.
    const member = await Member.findOne({ clerkUserId: userId }).select("-__v");
    if (member) req.member = member;

    next();
  } catch (error) {
    console.error("protect middleware error:", error.message);
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }
};