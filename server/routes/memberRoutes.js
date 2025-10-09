import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { createMemberProfile, getMemberProfile } from "../controllers/memberController.js";

const memberRouter = express.Router();

memberRouter.post("/", protect, createMemberProfile);
memberRouter.get("/me", protect, getMemberProfile);

export default memberRouter;
