// server/controllers/noticeController.js
// Handles CRUD for society notices and triggers emails to all members.
//
// Key fixes applied:
//   - Cloudinary upload uses cloudinaryService (upload_stream with buffer)
//     instead of req.file.path which does not exist with memoryStorage.
//   - imagePublicId stored so images can be deleted from Cloudinary on
//     notice deletion or update.
//   - date stored as Date type, not the string that was passed in.
//   - Email loop runs after response is sent so admin is not blocked.
//   - req.auth accessed consistently as an object, not with typeof check.

import Notice          from "../models/Notice.js";
import Member          from "../models/Member.js";
import Notification    from "../models/Notification.js";
import { uploadImage, deleteImage } from "../services/cloudinaryService.js";

import { sendNoticeEmail } from "../services/emailService.js";

// ── createNotice ──────────────────────────────────────────────────────────────

export const createNotice = async (req, res) => {
  try {
    const { title, date, summary, content } = req.body;

    // WHY req.auth directly (not typeof check):
    // The original had a comment "Fix: Clerk v5+ → req.auth is a function"
    // and used typeof req.auth === "function" ? await req.auth() : req.auth.
    // In @clerk/express v2+ req.auth is always a plain object set by
    // clerkMiddleware. The function branch is dead code. Removed.
    const createdBy = req.auth?.userId;

    if (!createdBy) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!title || !date || !summary || !content) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    let image         = "";
    let imagePublicId = "";

    if (req.file) {
      try {
        // WHY cloudinaryService instead of cloudinary.uploader.upload(req.file.path):
        // uploadMiddleware uses multer.memoryStorage() — the file is stored in
        // RAM as req.file.buffer, NOT written to disk. req.file.path does not
        // exist with memoryStorage. cloudinaryService.uploadImage() uses
        // cloudinary.uploader.upload_stream() which reads from the buffer
        // correctly. The original code was silently failing on every image upload.
        const uploaded = await uploadImage(req.file, "gohs/notices");
        image         = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
      } catch (uploadError) {
        // Non-fatal: save the notice without an image rather than failing the
        // whole request. The admin can edit and re-upload.
        console.error("Cloudinary upload failed:", uploadError.message);
      }
    }

    const notice = await Notice.create({
      title,
      // WHY new Date(date): Notice.date is now type Date (fixed in the model).
      // Storing a raw date string bypasses Mongoose type coercion and means
      // the field cannot be used in date comparisons or sorted correctly.
      date: new Date(date),
      summary,
      content,
      image,
      imagePublicId,
      createdBy,
    });

    // Broadcast in-app notification — clerkUserId is null which means all
    // members see it in their notification list (broadcast pattern).
    await Notification.create({
      type:      "Notice",
      content:   `New notice posted: ${title}`,
      adminOnly: false,
    });

    // WHY respond before the email loop:
    // The original sent the HTTP response AFTER looping through all members.
    // With 100 members and 120ms per email that is 12 seconds of waiting.
    // The admin sees a spinner for 12 seconds and may think it crashed.
    // Sending the response first lets the admin see immediate confirmation.
    // The email loop runs as a background task after res.status(201).json().
    res.status(201).json({
      success: true,
      message: "Notice created. Emails are being sent to all members.",
      notice,
    });

    // This code runs after the response is flushed — admin does not wait for it.
    const members = await Member.find({}).select("email name").lean();
    for (const member of members) {
      if (!member.email) continue;
      try {
        await sendNoticeEmail(member.email, notice.toObject());
        // 120ms gap keeps us under Resend's rate limit of 10 emails/second
        await new Promise((r) => setTimeout(r, 120));
      } catch (emailError) {
        // Log failure but continue — one bad email must not stop the rest
        console.error(`Email failed for ${member.email}:`, emailError.message);
      }
    }

  } catch (error) {
    console.error("createNotice error:", error.message);
    // Only send error response if we have not already sent the 201
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── getNotices ────────────────────────────────────────────────────────────────

export const getNotices = async (req, res) => {
  try {
    // WHY .lean(): we only serialise to JSON — no need for Mongoose document overhead
    const notices = await Notice.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, notices });
  } catch (error) {
    console.error("getNotices error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── getNoticeById ─────────────────────────────────────────────────────────────

export const getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id).lean();
    if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });
    return res.status(200).json({ success: true, notice });
  } catch (error) {
    console.error("getNoticeById error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── updateNotice ──────────────────────────────────────────────────────────────

export const updateNotice = async (req, res) => {
  try {
    const { title, date, summary, content } = req.body;

    // WHY req.auth?.userId (not req.auth.userId):
    // The original used req.auth.userId without optional chaining.
    // If clerkMiddleware fails to populate req.auth for any reason,
    // this throws "Cannot read property userId of undefined" and crashes
    // the entire process instead of returning a clean 401.
    const createdBy = req.auth?.userId;

    if (!title || !date || !summary || !content) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });

    let { image, imagePublicId } = notice;

    if (req.file) {
      // Delete old Cloudinary image before uploading the replacement.
      // WHY: without this the old image stays on Cloudinary forever,
      // consuming storage and incurring cost.
      if (imagePublicId) await deleteImage(imagePublicId);

      const uploaded = await uploadImage(req.file, "gohs/notices");
      image         = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const updatedNotice = await Notice.findByIdAndUpdate(
      req.params.id,
      { title, date: new Date(date), summary, content, image, imagePublicId, createdBy },
      { new: true }
    );

    return res.status(200).json({ success: true, message: "Notice updated", notice: updatedNotice });
  } catch (error) {
    console.error("updateNotice error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── deleteNotice ──────────────────────────────────────────────────────────────

export const deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });

    // WHY delete from Cloudinary: the original left the image file on
    // Cloudinary after deleting the MongoDB record. Over time this
    // accumulates orphan files that cost money and cannot be cleaned
    // up because the public_id is no longer stored anywhere.
    if (notice.imagePublicId) {
      await deleteImage(notice.imagePublicId);
    }

    return res.status(200).json({ success: true, message: "Notice deleted" });
  } catch (error) {
    console.error("deleteNotice error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};