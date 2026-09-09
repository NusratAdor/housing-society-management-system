// routes/memberRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
import {
  createMemberProfile,
  getMemberProfile,
  requestAdmin,
  getMemberSeat,
} from "../controllers/memberController.js";

const router = express.Router();

// Unguarded by requireActiveMember, deliberately:
//   - POST / already has its own removed-member check inside
//     createMemberProfile itself (blocks re-registration)
//   - GET /me must stay reachable so the frontend can read status and
//     show a clear "removed" message, rather than the request being
//     blocked outright with no explanation
router.post("/", protect, createMemberProfile);
router.get("/me", protect, getMemberProfile);

// Self-service actions — active members only
router.post("/request-admin", protect, requireActiveMember, requestAdmin);
router.get("/seat", protect, requireActiveMember, getMemberSeat);

export default router;