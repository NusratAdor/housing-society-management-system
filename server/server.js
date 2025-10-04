import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from '@clerk/express';
import clerkWebhooks from "./controllers/clerkWebhooks.js";
import memberRouter from "./routes/memberRoutes.js";
import noticeRouter from "./routes/noticeRoutes.js";
import questionRouter from "./routes/questionRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";

connectDB();

const app = express();
app.use(cors()); // Enable cross-origin Resource Sharing

// API to listen to Clerk Webhooks
app.use("/api/clerk", clerkWebhooks);

// Middleware
app.use(express.json());
app.use(clerkMiddleware());

app.get("/", (req, res) => res.send("API is working"));

app.use("/api/members", memberRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/questions", questionRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/notifications", notificationRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));