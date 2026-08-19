// server/routes/superAdminRoutes.js
// Every route here requires an ACTIVE StaffAccount with role
// "super_admin". Deliberately a separate router from adminRoutes.js —
// that one gates on Member.role === "admin", and Super Admin is
// explicitly not a Member. Mixing the two guards on one router would
// either lock Super Admin out or loosen adminRoutes.js unintentionally.

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireSuperAdmin } from "../middleware/staffMiddleware.js";
import { inviteStaff, getAllStaff, revokeStaff } from "../controllers/staffController.js";

const router = express.Router();

router.use(protect, requireSuperAdmin);

router.get("/staff", getAllStaff);
router.post("/staff", inviteStaff);
router.delete("/staff/:id", revokeStaff);

export default router;