import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from "@clerk/express";
import rateLimit from "express-rate-limit";
import clerkWebhooks from "./controllers/clerkWebhooks.js";
import memberRouter from "./routes/memberRoutes.js";

connectDB();
const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Rate limiter for /api/members endpoint
const memberLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // Limit each IP to 10 requests per 15 minutes
  message: { success: false, message: "Too many requests, please try again later" },
});

// Clerk webhook (no rate limiting, as it’s server-to-server)
app.use("/api/clerk", clerkWebhooks);

// Test API
app.get("/", (req, res) => res.send("Housing Society API running"));

// Member routes with rate limiting
app.use("/api/members", memberLimiter, memberRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));