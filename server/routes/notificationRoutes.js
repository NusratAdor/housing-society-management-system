// routes/notificationRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  getAdminNotifications,
  deleteAllNotifications,
  getMemberNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";

const router = express.Router();

// === MEMBER ROUTES (any authenticated user) ===
router.get("/me", protect, getMemberNotifications);
router.patch("/me/read-all", protect, markAllNotificationsRead); // before /me/:id/read
router.patch("/me/:id/read", protect, validateObjectId(), markNotificationRead);

// === ADMIN ROUTES (admin-only) ===
router.use(protect, isAdmin);
router.get("/", getAdminNotifications);
router.delete("/", deleteAllNotifications);

export default router;