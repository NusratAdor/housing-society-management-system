// server/routes/faqRoutes.js
//
// Route map:
//
// PUBLIC (no auth):
//   GET    /api/faqs/public          → getPublicFAQs   (home page)
//
// MEMBER (protect only):
//   GET    /api/faqs/me              → getMemberFAQs   (their answered FAQs)
//   GET    /api/faqs/pending/me      → getMemberPending (their pending, persists refresh)
//   POST   /api/faqs/pending         → submitPending
//   DELETE /api/faqs/pending/me/:id  → deleteMemberPending (member withdraws)
//   DELETE /api/faqs/member/:id      → deleteMemberFAQ  (soft-delete from member view)
//
// ADMIN (protect + isAdmin):
//   GET    /api/faqs/                → getFAQs         (all non-admin-deleted)
//   GET    /api/faqs/pending         → getPending      (all active pending)
//   POST   /api/faqs/                → answerFAQ
//   PUT    /api/faqs/:id             → updateFAQ
//   DELETE /api/faqs/:id             → deleteFAQ       (admin soft-delete)
//   DELETE /api/faqs/pending/:id     → deletePending   (admin hard-delete pending)
//   PATCH  /api/faqs/:id/toggle-public → togglePublic
//
// NOTE on route ordering:
//   Specific paths (/public, /me, /pending/me, /pending) MUST be declared
//   before parameterised paths (/:id) otherwise Express matches /:id first
//   and "public", "me", "pending" become the id parameter.

import express from "express";
import { protect }  from "../middleware/authMiddleware.js";
import { isAdmin }  from "../middleware/adminMiddleware.js";
import {
  getPublicFAQs,
  getMemberFAQs,
  getMemberPending,
  submitPending,
  deleteMemberPending,
  deleteMemberFAQ,
  getFAQs,
  getPending,
  answerFAQ,
  updateFAQ,
  deleteFAQ,
  deletePending,
  togglePublic,
} from "../controllers/faqController.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/public", getPublicFAQs);

// ── Member ────────────────────────────────────────────────────────────────────
router.get(    "/me",               protect, getMemberFAQs);
router.get(    "/pending/me",       protect, getMemberPending);
router.post(   "/pending",          protect, submitPending);
router.delete( "/pending/me/:id",   protect, deleteMemberPending);
router.delete( "/member/:id",       protect, deleteMemberFAQ);

// ── Admin — apply guard once, all routes below inherit it ─────────────────────
router.use(protect, isAdmin);
router.get(    "/",                 getFAQs);
router.get(    "/pending",          getPending);
router.post(   "/",                 answerFAQ);
router.put(    "/:id",              updateFAQ);
router.delete( "/:id",              deleteFAQ);
router.delete( "/pending/:id",      deletePending);
router.patch(  "/:id/toggle-public", togglePublic);

export default router;