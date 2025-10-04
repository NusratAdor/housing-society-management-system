import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { createMember, getMemberProfile, updateMemberProfile } from "../controllers/memberController.js";

const memberRouter = express.Router();

memberRouter.post("/", protect, createMember);
memberRouter.get("/me", protect, getMemberProfile);
memberRouter.put("/me", protect, updateMemberProfile);

export default memberRouter;