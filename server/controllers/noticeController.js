// server/controllers/noticeController.js
//
// CHANGE (latest): uploadAttachment now captures file.originalname and
// returns it as attachmentOriginalName, which createNotice/updateNotice
// save onto the Notice document. This is what NoticeDetail.jsx now
// displays, instead of deriving a name from attachmentPublicId (which
// was either a random Cloudinary id or a timestamp-prefixed Supabase
// path — never meant to be shown to a member).
//
// PRIOR CHANGE: attachments split by file type across two storage
// providers, based on the mimetype of the uploaded file:
//   - Images (jpg/png/webp)  -> Cloudinary (unchanged from before —
//     this is what Cloudinary is actually built for: transformation,
//     optimization, CDN delivery for images)
//   - PDFs                   -> Supabase Storage (Cloudinary enforces
//     an account-level restriction on public PDF delivery that caused
//     the 401 errors; Supabase Storage has no such restriction)
//
// Both cases still populate the SAME `attachment` field on the Notice
// document — the frontend doesn't need to know or care which provider
// actually served a given file. attachmentType ("image" | "pdf") is
// what drives frontend rendering, exactly as before.
//
// attachmentPublicId now stores different things depending on provider:
//   - Cloudinary (images): the Cloudinary public_id, as before
//   - Supabase (PDFs): the storage path within the bucket, needed to
//     delete the file later
// This remains an internal implementation detail used only for
// deletion — it is never read for display anymore (that's now
// attachmentOriginalName's job).

import { v2 as cloudinary } from "cloudinary";
import { supabase } from "../configs/connectSupabase.js";
import Notice from "../models/Notice.js";

const SUPABASE_BUCKET = "notice-attachments";

// ─── Cloudinary helpers (images only now) ──────────────────────────────────

const uploadImageToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "notices", resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });

const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error("[Notice] Cloudinary delete failed:", err.message);
  }
};

// ─── Supabase helpers (PDFs only) ───────────────────────────────────────────

const uploadPdfToSupabase = async (buffer, originalName) => {
  // A unique, safe filename — timestamp + sanitized original name avoids
  // collisions and keeps the original filename recognizable for admins
  // in the Supabase dashboard. This prefixed path is NEVER used for
  // display in the UI — see attachmentOriginalName below for that.
  const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path     = `notices/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert:      false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);

  return { url: data.publicUrl, path };
};

const deletePdfFromSupabase = async (path) => {
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove([path]);
    if (error) console.error("[Notice] Supabase delete failed:", error.message);
  } catch (err) {
    console.error("[Notice] Supabase delete failed:", err.message);
  }
};

// ─── unified helpers — pick the right provider based on file type ─────────

const uploadAttachment = async (file) => {
  const isPdf = file.mimetype === "application/pdf";

  if (isPdf) {
    const { url, path } = await uploadPdfToSupabase(file.buffer, file.originalname);
    return {
      url,
      publicId:       path,
      originalName:   file.originalname, // clean name, captured before any prefixing
      attachmentType: "pdf",
    };
  }

  const { url, publicId } = await uploadImageToCloudinary(file.buffer);
  return {
    url,
    publicId,
    originalName:   file.originalname, // Cloudinary never had this — capture it ourselves
    attachmentType: "image",
  };
};

// Deletes an existing attachment from whichever provider it lives on.
// attachmentType tells us which — "pdf" means Supabase, anything else
// (including legacy notices with no attachmentType but an old image)
// means Cloudinary.
const deleteAttachment = async (publicId, attachmentType) => {
  if (!publicId) return;
  if (attachmentType === "pdf") {
    await deletePdfFromSupabase(publicId);
  } else {
    await deleteImageFromCloudinary(publicId);
  }
};

// ─── getNotices ───────────────────────────────────────────────────────────────

export const getNotices = async (req, res) => {
  try {
    const notices = await Notice
      .find()
      .sort({ date: -1 })
      .select("-content")
      .lean();

    return res.status(200).json({ success: true, notices });
  } catch (error) {
    console.error("getNotices error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── getNoticeById ────────────────────────────────────────────────────────────

export const getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id).lean();
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }
    return res.status(200).json({ success: true, notice });
  } catch (error) {
    console.error("getNoticeById error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── createNotice ─────────────────────────────────────────────────────────────

export const createNotice = async (req, res) => {
  try {
    const { title, date, summary } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required" });
    }
    if (!summary?.trim()) {
      return res.status(400).json({ success: false, message: "Summary is required" });
    }

    let attachment             = "";
    let attachmentPublicId     = "";
    let attachmentOriginalName = "";
    let attachmentType         = "";

    if (req.file) {
      const result           = await uploadAttachment(req.file);
      attachment             = result.url;
      attachmentPublicId     = result.publicId;
      attachmentOriginalName = result.originalName;
      attachmentType         = result.attachmentType;
    }

    const notice = await Notice.create({
      title:   title.trim(),
      date:    new Date(date),
      summary: summary.trim(),
      content: "",
      attachment,
      attachmentPublicId,
      attachmentOriginalName,
      attachmentType,
      createdBy: req.clerkUserId,
    });

    return res.status(201).json({ success: true, notice });
  } catch (error) {
    console.error("createNotice error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── updateNotice ─────────────────────────────────────────────────────────────

export const updateNotice = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const { title, date, summary, removeAttachment } = req.body;

    if (title)   notice.title   = title.trim();
    if (date)    notice.date    = new Date(date);
    if (summary) notice.summary = summary.trim();

    if (req.file) {
      // Delete the existing attachment first — from whichever provider
      // it's actually on (checks attachmentType, falls back to legacy
      // imagePublicId which was always Cloudinary).
      const existingPublicId = notice.attachmentPublicId || notice.imagePublicId;
      const existingType     = notice.attachmentType || (notice.imagePublicId ? "image" : "");
      await deleteAttachment(existingPublicId, existingType);

      const result = await uploadAttachment(req.file);
      notice.attachment             = result.url;
      notice.attachmentPublicId     = result.publicId;
      notice.attachmentOriginalName = result.originalName;
      notice.attachmentType         = result.attachmentType;

      notice.image         = "";
      notice.imagePublicId = "";

    } else if (removeAttachment === "true") {
      const existingPublicId = notice.attachmentPublicId || notice.imagePublicId;
      const existingType     = notice.attachmentType || (notice.imagePublicId ? "image" : "");
      await deleteAttachment(existingPublicId, existingType);

      notice.attachment             = "";
      notice.attachmentPublicId     = "";
      notice.attachmentOriginalName = "";
      notice.attachmentType         = "";
      notice.image                  = "";
      notice.imagePublicId          = "";
    }

    await notice.save();
    return res.status(200).json({ success: true, notice });
  } catch (error) {
    console.error("updateNotice error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── deleteNotice ─────────────────────────────────────────────────────────────

export const deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const publicId = notice.attachmentPublicId || notice.imagePublicId;
    const type     = notice.attachmentType || (notice.imagePublicId ? "image" : "");
    await deleteAttachment(publicId, type);

    await Notice.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Notice deleted" });
  } catch (error) {
    console.error("deleteNotice error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};