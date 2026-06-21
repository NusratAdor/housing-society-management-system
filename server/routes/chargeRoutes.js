// server/routes/chargeRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin }  from "../middleware/adminMiddleware.js";
import {
  createCharge,
  getAllCharges,
  getMemberCharges,
  cancelCharge,
  getChargeById,
} from "../controllers/chargeController.js";

const router = express.Router();

// ── Member routes (authenticated, any role) ───────────────────────────────────
// Member reads their own unpaid charges — shown in PaymentSection
router.get("/me", protect, getMemberCharges);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post("/",     protect, isAdmin, createCharge);     // create charge(s)
router.get("/",      protect, isAdmin, getAllCharges);     // all charges with filters
router.get("/:id",   protect, isAdmin, getChargeById);    // single charge + batch info
router.delete("/:id", protect, isAdmin, cancelCharge);    // cancel (not delete)

export default router;