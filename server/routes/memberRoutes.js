// routes/memberRoutes.js
import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
import {
  createMemberProfile,
  getMemberProfile,
  requestAdmin,
  getMemberSeat,
  updateOwnProfile,
} from "../controllers/memberController.js";

const router = express.Router();

// Registration is the only place a membershipNo + phone guess can be tried.
// Per signed-in user; only FAILED attempts count, so a real registration
// never uses up the allowance.
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.clerkUserId,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

// Unguarded by requireActiveMember, deliberately:
//   - POST / has its own removed-member check inside createMemberProfile
//   - GET /me must stay reachable so the frontend can show a "removed" message
router.post("/", protect, registrationLimiter, createMemberProfile);
router.get("/me", protect, getMemberProfile);

// Self-service actions — active members only
router.patch("/me", protect, requireActiveMember, updateOwnProfile);
router.post("/request-admin", protect, requireActiveMember, requestAdmin);
router.get("/seat", protect, requireActiveMember, getMemberSeat);

export default router;