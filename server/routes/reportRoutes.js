// server/routes/reportRoutes.js

import express     from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  downloadMemberReceipt,
  downloadMemberPdf,
  downloadMemberCsv,
  downloadAdminPdf,
  downloadAdminCsv,
} from "../controllers/reportController.js";

const router = express.Router();

// ── Member routes ─────────────────────────────────────────────────────────────
// Receipt for a single payment
router.get("/me/receipt/:paymentId", protect, downloadMemberReceipt);
// Transaction history PDF and CSV for a date range
router.get("/me/pdf",                protect, downloadMemberPdf);
router.get("/me/csv",                protect, downloadMemberCsv);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get("/admin/pdf",             protect, isAdmin, downloadAdminPdf);
router.get("/admin/csv",             protect, isAdmin, downloadAdminCsv);

export default router;