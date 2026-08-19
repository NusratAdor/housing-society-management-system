// server/routes/staffRoutes.js
// Self-service — any authenticated user can check/activate their own
// StaffAccount. No extra role gate, same pattern as GET /api/members/me.

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getStaffProfile } from "../controllers/staffController.js";

const router = express.Router();

router.get("/me", protect, getStaffProfile);

export default router;