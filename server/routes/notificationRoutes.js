// routes/notificationRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  getAdminNotifications,
  deleteAllNotifications,
  getMemberNotifications,
} from "../controllers/notificationController.js";

const router = express.Router();

// === ADMIN ROUTES (admin-only) ===
router.use(protect, isAdmin);
router.get("/", getAdminNotifications);
router.delete("/", deleteAllNotifications);

// === MEMBER ROUTE (any authenticated user) ===
router.get("/me", protect, getMemberNotifications);

export default router;