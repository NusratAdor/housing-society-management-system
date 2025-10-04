import express from "express";
import { protect, protectAdmin } from "../middleware/authMiddleware.js";
import { getNotifications, createNotification } from "../controllers/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.get("/me", protect, getNotifications);
notificationRouter.post("/", protectAdmin, createNotification);

export default notificationRouter;