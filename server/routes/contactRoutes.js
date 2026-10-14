// server/routes/contactRoutes.js
import express from "express";
import rateLimit from "express-rate-limit";
import { submitContactMessage } from "../controllers/contactController.js";

const router = express.Router();

// Public endpoint, so it gets its own tight limit: 5 messages per IP per hour.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many messages sent. Please try again later.",
  },
});

router.post("/", contactLimiter, submitContactMessage);

export default router;