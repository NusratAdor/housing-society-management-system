// server.js
import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from "@clerk/express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import clerkWebhooks from "./controllers/clerkWebhooks.js";
import runDailyJobs from "./jobs/paymentJobs.js";
import memberRouter from "./routes/memberRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import noticeRouter from "./routes/noticeRoutes.js";
import connectCloudinary from "./configs/cloudinary.js";
import galleryRoutes from "./routes/galleryRoutes.js";
import faqRoutes from "./routes/faqRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";


import paymentRedirects from "./routes/paymentRedirects.js";

import chargeRoutes from "./routes/chargeRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

await connectDB();
connectCloudinary();

runDailyJobs();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(
  clerkMiddleware({
    onError: (error) => ({
      status: 401,
      message: "Unauthorized request",
      details: error.message,
    }),
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use("/api/clerk", clerkWebhooks);


app.get("/", (req, res) => res.send("Housing Society API is running smoothly!"));

const memberLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 600,
  message: { success: false, message: "Too many actions in a short time. Please wait a moment." },
});
app.use("/api/members", memberLimiter, memberRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/gallery", galleryRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/payments", paymentRoutes);

app.use("/api/charges", chargeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportRoutes);

// ── MOUNT REDIRECTS AT ROOT ──
app.use("/payment", paymentRedirects);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));