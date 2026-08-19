// server/middleware/staffMiddleware.js
// Authorization guards for the StaffAccount system. Must run after
// protect. Neither guard modifies or depends on the other — Admin is
// always checked via req.member.role, Content Manager/Super Admin
// always via req.staff.role. Membership and staff authorization stay
// fully decoupled, matching the data model.

// Admin (Member.role === "admin") retains full access, per requirement.
// Content Manager gets exactly this slice — notices/gallery/
// announcements/FAQ-answering routes only.
export const canManageContent = (req, res, next) => {
  const isAdmin = req.member?.role === "admin";
  const isContentManager = req.staff?.role === "content_manager";

  if (!isAdmin && !isContentManager) {
    return res.status(403).json({
      success: false,
      message: "Access denied — content management permission required",
    });
  }

  next();
};

// Super Admin's ONLY permission, by design: managing staff accounts.
export const requireSuperAdmin = (req, res, next) => {
  if (req.staff?.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied — super admin permission required",
    });
  }

  next();
};