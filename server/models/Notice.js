// server/models/Notice.js
//
// CHANGE (latest): added attachmentOriginalName — stores the filename
// exactly as the admin's computer named it (from multer's
// req.file.originalname), independent of whatever identifier the
// storage provider generates internally.
//
// Why this is needed: attachmentPublicId is NOT a display name — it's
// a storage-internal path/id:
//   - Cloudinary (images): an auto-generated opaque id like
//     "wzf3z2wzfduehpqgtzyl" (no filename info at all, since the
//     upload never passed use_filename/public_id)
//   - Supabase (PDFs): "notices/1783610835078-GOHS_Official_Notice.pdf"
//     — has a real filename, but prefixed with Date.now() to keep
//     bucket paths collision-free
// Deriving a display name from either of those was always going to
// either show a random string or a timestamp-polluted filename.
// attachmentOriginalName fixes this by storing the clean name once,
// separately, purely for display purposes.
//
// PRIOR CHANGES (unchanged from before):
//   - attachment: URL for either image or PDF (replaces image field)
//   - attachmentPublicId: Cloudinary public_id or Supabase storage path,
//     used only for deletion — never for display
//   - attachmentType: "image" | "pdf" | "" — drives frontend rendering
//   - content: made optional (was required) — description removed from UI
//   - image / imagePublicId: kept for backward compatibility with existing
//     notices that were created before this change. New notices use
//     attachment / attachmentPublicId / attachmentType instead.

import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    date:    { type: Date,   required: true },
    summary: { type: String, required: true, trim: true },
    // content made optional — admin UI no longer shows description field.
    // Existing notices that have content will still display it on NoticeDetail.
    content: { type: String, default: "" },

    // New unified attachment fields — supports both image and PDF
    attachment:             { type: String, default: "" }, // public URL
    attachmentPublicId:     { type: String, default: "" }, // storage path/id — deletion only, NOT for display
    attachmentOriginalName: { type: String, default: "" }, // clean filename — for display only
    attachmentType: {
      type:    String,
      enum:    ["image", "pdf", ""],
      default: "",
    },

    // Legacy fields — kept for backward compatibility, do not use in new code
    image:        { type: String, default: "" },
    imagePublicId:{ type: String, default: "" },

    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Notice", noticeSchema);