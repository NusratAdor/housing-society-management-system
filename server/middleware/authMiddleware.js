import { requireAuth } from "@clerk/express";
import Member from "../models/Member.js";

export const protect = async (req, res, next) => {
  const auth = req.auth;
  const userId = auth?.userId;
  if (!userId) {
    return res.json({ success: false, message: "Not authenticated" });
  }
  const member = await Member.findOne({ clerkUserId: userId });
  if (!member) {
    return res.json({ success: false, message: "Member profile not found" });
  }
  req.member = member;
  next();
};

export const protectAdmin = async (req, res, next) => {
  const auth = req.auth;
  const userId = auth?.userId;
  if (!userId) {
    return res.json({ success: false, message: "Not authenticated" });
  }
  const user = auth?.user;
  if (!user || user.unsafeMetadata?.role !== "admin") {
    return res.json({ success: false, message: "Admin access required" });
  }
  const member = await Member.findOne({ clerkUserId: userId });
  if (!member) {
    return res.json({ success: false, message: "Member profile not found" });
  }
  req.member = member;
  next();
};

export const clerkMiddleware = requireAuth({
  publicRoutes: ["/api/notices"],
});