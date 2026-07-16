// routes/announcementRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  getAnnouncements,
  getActiveAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcementController.js";

const router = express.Router();

// Public — homepage banner reads this
router.get("/active", getActiveAnnouncement);

// Admin only
router.use(protect, isAdmin);
router.get("/", getAnnouncements);
router.post("/", createAnnouncement);
router.put("/:id", updateAnnouncement);
router.delete("/:id", deleteAnnouncement);

export default router;