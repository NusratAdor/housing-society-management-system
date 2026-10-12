import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
import { createRequest } from "../controllers/serviceRequestController.js";

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.clerkUserId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

router.post("/", protect, requireActiveMember, createLimiter, createRequest);

export default router;