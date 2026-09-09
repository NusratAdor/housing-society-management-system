// server/middleware/staffMiddleware.js
// Authorization guards for the StaffAccount system. Must run after
// protect. The Admin branch of canManageContent now also checks
// status, same reasoning as isAdmin.js — a removed admin should not
// retain content-management access either. The Content Manager branch
// needs no equivalent change: protect only ever attaches req.staff
// when StaffAccount.active is true, so that path is already correctly
// enforced at the source.

export const canManageContent = (req, res, next) => {
  const isAdmin = req.member?.role === "admin" && req.member?.status === "active";
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