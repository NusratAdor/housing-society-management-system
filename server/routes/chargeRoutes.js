// server/routes/chargeRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin }  from "../middleware/adminMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
import {
  createCharge,
  getAllCharges,
  getMemberCharges,
  cancelCharge,
  getChargeById,
} from "../controllers/chargeController.js";

const router = express.Router();

// ── Member routes (active members only) ────────────────────────────────────
router.get("/me", protect, requireActiveMember, getMemberCharges);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post("/",     protect, isAdmin, createCharge);
router.get("/",      protect, isAdmin, getAllCharges);
router.get("/:id",   protect, isAdmin, getChargeById);
router.delete("/:id", protect, isAdmin, cancelCharge);

export default router;