// middleware/authMiddleware.js
import Member from "../models/Member.js";

export const protect = async (req, res, next) => {
  try {
    // Clerk v5+ injects req.auth as a FUNCTION
    const auth = typeof req.auth === "function" ? await req.auth() : req.auth;

    if (!auth || !auth.userId) {
      return res.status(401).json({ success: false, message: "Unauthorized – no user ID" });
    }

    const clerkUserId = auth.userId;
    req.clerkUserId = clerkUserId; // THIS IS REQUIRED

    // Attach member for convenience
    const member = await Member.findOne({ clerkUserId });
    if (member) {
      req.member = member;
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ success: false, message: "Invalid auth token" });
  }
};