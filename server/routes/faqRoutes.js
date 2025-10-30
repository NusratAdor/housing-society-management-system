// routes/faqRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  submitPending,
  getPending,
  answerFAQ,
  getFAQs,
  updateFAQ,
  deleteFAQ,
  deletePending,
  deleteMemberFAQ,
} from "../controllers/faqController.js";

const router = express.Router();

// === PUBLIC / MEMBER ===
router.get("/", getFAQs);
router.post("/pending", protect, submitPending);
router.delete("/member/:id", protect, deleteMemberFAQ); // NEW: Member delete

// === ADMIN ONLY ===
router.use(protect, isAdmin);
router.get("/pending", getPending);
router.post("/", answerFAQ);
router.put("/:id", updateFAQ);
router.delete("/:id", deleteFAQ);           // Admin delete FAQ
router.delete("/pending/:id", deletePending); // Admin delete pending

export default router;