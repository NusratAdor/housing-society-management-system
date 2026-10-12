// server/routes/reportRoutes.js
import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import { requireActiveMember } from "../middleware/memberStatusMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  downloadMemberReceipt,
  downloadMemberPdf,
  downloadMemberCsv,
  downloadAdminPdf,
  downloadAdminCsv,
  serveAdminReport,
} from "../controllers/reportController.js";

const router = express.Router();

// PDF generation is the most CPU-heavy thing an admin can trigger.
const adminReportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many report requests. Please wait a few minutes." },
});

// ── Member: own receipt and history ──────────────────────────────────────────
router.get("/me/receipt/:paymentId", protect, requireActiveMember, validateObjectId("paymentId"), downloadMemberReceipt);
router.get("/me/pdf", protect, requireActiveMember, downloadMemberPdf);
router.get("/me/csv", protect, requireActiveMember, downloadMemberCsv);

// ── Admin ────────────────────────────────────────────────────────────────────
router.use("/admin", protect, isAdmin, adminReportLimiter);

router.get("/admin/pdf", downloadAdminPdf);   // existing collection endpoints
router.get("/admin/csv", downloadAdminCsv);

router.get("/admin/directory", serveAdminReport("directory"));
router.get("/admin/collection", serveAdminReport("collection"));
router.get("/admin/outstanding", serveAdminReport("outstanding"));
router.get("/admin/statement/:memberId", validateObjectId("memberId"), serveAdminReport("statement"));

export default router;