// server/middleware/adminMiddleware.js
// Confirms the authenticated user has role "admin" in the Member collection.
// Must run after protect middleware because it relies on req.clerkUserId.
//
// The ADMIN_CLERK_ID env-variable shortcut has been intentionally removed.
// Reasons:
//   1. It created a fake member object with no _id, no .save() method, and
//      no real MongoDB document. Any controller calling req.member.save()
//      or req.member._id after isAdmin would crash silently.
//   2. It implied that a "super admin" exists outside the database, making
//      the system harder to reason about and audit.
//   3. The correct approach is to create a real Member document for the
//      admin in MongoDB and set role:"admin" there. This is done once via
//      the seed script or directly in MongoDB Atlas.

import Member from "../models/Member.js";

export const isAdmin = async (req, res, next) => {
  try {
    const { clerkUserId } = req;

    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Reuse req.member if protect already loaded it — avoids a second DB query
    // on every admin request. If protect did not find a member (new user),
    // req.member is undefined and we query here.
    const member = req.member ?? await Member.findOne({ clerkUserId });

    if (!member || member.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied — admin permission required",
      });
    }

    // Ensure req.member is always the real Mongoose document
    req.member = member;
    next();
  } catch (error) {
    console.error("isAdmin middleware error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};