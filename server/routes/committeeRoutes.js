// routes/committeeRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getCommitteeMembers,
  getCommitteeMemberById,
  createCommitteeMember,
  updateCommitteeMember,
  deleteCommitteeMember,
} from "../controllers/committeeController.js";

const router = express.Router();

// Public — supports ?category=chairman etc.
router.get("/", getCommitteeMembers);
router.get("/:id", getCommitteeMemberById);

// Admin only
router.use(protect, isAdmin);
router.post("/", upload.single("photo"), createCommitteeMember);
router.put("/:id", upload.single("photo"), updateCommitteeMember);
router.delete("/:id", deleteCommitteeMember);

export default router;