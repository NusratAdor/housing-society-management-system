// server/routes/memberSeatRoutes.js

import express from "express";
import {
  getAllSeats,
  createSeat,
  updateSeat,
  deleteSeat,
} from "../controllers/memberSeatController.js";

const router = express.Router();
// Auth + isAdmin applied globally by adminRoutes.js — no need to repeat here

router.get(    "/",    getAllSeats);
router.post(   "/",    createSeat);
router.put(    "/:id", updateSeat);
router.delete( "/:id", deleteSeat);

export default router;