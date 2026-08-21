// server/middleware/imageUploadMiddleware.js
//
// Dedicated upload middleware for PHOTO-ONLY contexts — Committee
// member photos, Gallery images. Deliberately separate from
// uploadMiddleware.js (which also accepts PDFs, for notice
// attachments where that's appropriate).
//
// Two differences from uploadMiddleware.js, both intentional:
//   1. No PDF acceptance — a photo field should never silently accept
//      a document that can't render as an <img>.
//   2. 5MB per file, not 10MB — comfortably covers a real phone photo
//      with headroom, while keeping memory usage sane. multer buffers
//      uploads in memory (memoryStorage) before forwarding to
//      Cloudinary, so the per-file cap directly controls how much
//      memory a single request can consume — this matters most for
//      Gallery, which accepts up to 10 files per request
//      (10 × 5MB = 50MB worst case, versus 100MB at the old 10MB cap).

import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, or WEBP images are allowed"));
  }

  cb(null, true);
};

const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
  },
  fileFilter,
});

export default imageUpload;