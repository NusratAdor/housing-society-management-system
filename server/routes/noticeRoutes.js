import express from "express";
import { protectAdmin } from "../middleware/authMiddleware.js";
import { getNotices, createNotice } from "../controllers/noticeController.js";

const noticeRouter = express.Router();

noticeRouter.get("/", getNotices);
noticeRouter.post("/", protectAdmin, createNotice);

export default noticeRouter;