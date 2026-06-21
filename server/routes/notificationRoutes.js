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

// === MEMBER ROUTE (any authenticated user) ===
router.get("/me", protect, getMemberNotifications);


// === ADMIN ROUTES (admin-only) ===
router.use(protect, isAdmin);
router.get("/", getAdminNotifications);
router.delete("/", deleteAllNotifications);



export default router;