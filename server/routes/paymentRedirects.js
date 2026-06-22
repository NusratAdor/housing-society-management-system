import express from "express";

const router = express.Router();

// SSLCommerz POSTs to these URLs after payment.
// Accept both GET and POST — GET for browser back-navigation,
// POST for SSLCommerz redirect after payment completion.

router.all("/success", (req, res) => {
  console.info("[Payment] SSLCommerz redirected to /payment/success");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=VALID`);
});

router.all("/failed", (req, res) => {
  console.info("[Payment] SSLCommerz redirected to /payment/failed");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=FAILED`);
});

router.all("/cancel", (req, res) => {
  console.info("[Payment] SSLCommerz redirected to /payment/cancel");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=CANCEL`);
});

export default router;