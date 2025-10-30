import Member from "../models/Member.js";

export const isAdmin = async (req, res, next) => {
  try {
    const { clerkUserId } = req;
    console.log("isAdmin middleware: clerkUserId =", clerkUserId);

    if (clerkUserId === process.env.ADMIN_CLERK_ID) {
      req.member = {
        clerkUserId,
        role: "admin",
        name: process.env.ADMIN_NAME || "Admin",
        email: process.env.ADMIN_EMAIL || "admin@example.com",
      };
      return next();
    }

    const member = await Member.findOne({ clerkUserId });
    if (!member || member.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied, admin permission required" });
    }

    req.member = member;
    next();
  } catch (error) {
    console.error(`isAdmin error: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
