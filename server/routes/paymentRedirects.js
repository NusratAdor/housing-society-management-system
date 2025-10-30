// routes/paymentRedirects.js
import express from "express";
const router = express.Router();

router.get("/success", (req, res) => {
  console.log("SSLCOMMERZ → SUCCESS → Redirecting to dashboard");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=VALID`);
});

router.get("/failed", (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=FAILED`);
});

router.get("/cancel", (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=CANCEL`);
});

export default router;