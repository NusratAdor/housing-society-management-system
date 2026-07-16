// server/middleware/uploadMiddleware.js
//
// CHANGE: added application/pdf to allowed types.
// File size limit increased to 10MB to accommodate PDF files.
// resource_type handling is done in the controller via Cloudinary's
// "auto" option — multer itself just needs to accept the file.

import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed"));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB — accommodates PDFs
  },
  fileFilter,
});

export default upload;