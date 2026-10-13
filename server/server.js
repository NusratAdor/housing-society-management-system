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
import connectSupabase from "./configs/connectSupabase.js"; 
import galleryRoutes from "./routes/galleryRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import faqRoutes from "./routes/faqRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import committeeRoutes from "./routes/committeeRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";

import paymentRedirects from "./routes/paymentRedirects.js";

import chargeRoutes from "./routes/chargeRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

import reportRoutes from "./routes/reportRoutes.js";

import staffRoutes from "./routes/staffRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";

import serviceRequestRoutes from "./routes/serviceRequestRoutes.js";

import testRoutes from "./routes/testRoutes.js";

await connectDB();
connectCloudinary();
connectSupabase(); 
runDailyJobs();

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
    ],
  })
);

// Clerk webhook — must be mounted before express.json() so
// verifyWebhook() receives the raw request body.
// Keep this endpoint outside the generic application rate limiter;
// webhook delivery is handled separately from normal API traffic.
app.post(
  "/api/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhooks
);

// ── Normal body parsers — everything else in the app uses these ────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.get("/", (req, res) => res.send("GOHS API is running smoothly!"));

const memberLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 600,
  message: { success: false, message: "Too many actions in a short time. Please wait a moment." },
});

app.use("/api/staff", staffRoutes);
app.use("/api/super-admin", superAdminRoutes);

app.use("/api/members", memberLimiter, memberRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/gallery", galleryRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/committee", committeeRoutes);
app.use("/api/announcements", announcementRoutes);

app.use("/api/charges", chargeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportRoutes);

app.use("/api/service-requests", serviceRequestRoutes);

app.use("/payment", paymentRedirects);
app.use("/test", testRoutes);



app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Not found",
  });
});


// Last: turns upload/validation errors into JSON instead of Express's default page.
app.use((err, req, res, next) => {
  if (err?.name === "MulterError" || err?.message === "Only CSV files are allowed") {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error("Unhandled error:", err?.message);
  return res.status(500).json({ success: false, message: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));