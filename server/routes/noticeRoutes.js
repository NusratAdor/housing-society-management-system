// routes/noticeRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  createNotice,
  getNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
} from "../controllers/noticeController.js";

const router = express.Router();

// Public routes
router.get("/", getNotices);
router.get("/:id", getNoticeById);

// Admin-only routes
router.use(protect, isAdmin);
router.post("/", upload.single("image"), createNotice);
router.put("/:id", upload.single("image"), updateNotice);
router.delete("/:id", deleteNotice);

export default router;