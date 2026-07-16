// server/routes/memberSeatRoutes.js

import express from "express";
import multer  from "multer";
import {
  getAllSeats,
  createSeat,
  updateSeat,
  deleteSeat,
  importSeatsFromCSV,
} from "../controllers/memberSeatController.js";

const router = express.Router();

// CSV-only upload middleware — separate from the image/PDF upload middleware
// Only accepts text/csv or application/octet-stream (some browsers send this for .csv)
// Max 2MB — 1000 rows of CSV is well under 100KB, 2MB is very generous
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel", // IE sends this for .csv
      "text/plain",               // some systems send .csv as text/plain
      "application/octet-stream", // generic binary — validated by content check in controller
    ];
    if (!allowed.includes(file.mimetype) && !file.originalname.endsWith(".csv")) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  },
});

// Auth + isAdmin applied globally by adminRoutes.js
router.get(    "/",           getAllSeats);
router.post(   "/",           createSeat);
router.post(   "/import",     csvUpload.single("csvFile"), importSeatsFromCSV);
router.put(    "/:id",        updateSeat);
router.delete( "/:id",        deleteSeat);

export default router;