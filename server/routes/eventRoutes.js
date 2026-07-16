// routes/eventRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getPublicEvents,
  getPublicEventById,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/eventController.js";

const router = express.Router();

// Public
router.get("/public", getPublicEvents);
router.get("/public/:id", getPublicEventById);

// Admin only
router.use(protect, isAdmin);
router.get("/", getEvents);
router.post("/", upload.single("image"), createEvent);
router.put("/:id", upload.single("image"), updateEvent);
router.delete("/:id", deleteEvent);

export default router;