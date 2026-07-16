// routes/galleryRoutes.js
//
// CHANGE:
//   - upload.single("image") -> upload.array("images", 10) on both
//     create and update, so the admin can select multiple files in one
//     go. Capped at 10 per item — a reasonable ceiling to prevent
//     abuse; adjust the number if you need more per event.
//   - New GET /:id route (public, same tier as the list route above
//     it) for the gallery detail page — mirrors how noticeRoutes.js
//     exposes GET /:id for getNoticeById.

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  createGalleryItem,
  getGalleryItems,
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
} from "../controllers/galleryController.js";

const router = express.Router();

// Public
router.get("/", getGalleryItems);
router.get("/:id", getGalleryItemById);

// Admin only
router.use(protect, isAdmin);
router.post("/", upload.array("images", 10), createGalleryItem);
router.put("/:id", upload.array("images", 10), updateGalleryItem);
router.delete("/:id", deleteGalleryItem);

export default router;