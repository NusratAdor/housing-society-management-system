// routes/memberRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createMemberProfile,
  getMemberProfile,
  requestAdmin, // New import
} from "../controllers/memberController.js";

import { getMemberSeat } from "../controllers/memberController.js";


const router = express.Router();

// Member routes
router.post("/", protect, createMemberProfile);
router.get("/me", protect, getMemberProfile);
router.post("/request-admin", protect, requestAdmin); // New route

// Add alongside existing member routes:
router.get("/seat", protect, getMemberSeat);

export default router;