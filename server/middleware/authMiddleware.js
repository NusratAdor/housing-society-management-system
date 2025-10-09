import Member from "../models/Member.js";

export const protect = async (req, res, next) => {
  try {
    // Clerk middleware sets req.auth with userId
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: No user ID found" });
    }

    req.clerkUserId = userId;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized: Authentication error" });
  }
};