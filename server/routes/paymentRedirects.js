// server/routes/paymentRedirects.js
//
// SSLCommerz redirects the member's browser to one of these URLs
// after payment is processed on their side.
//
// The member's browser hits /payment/success (or /failed or /cancel)
// on your BACKEND. The backend immediately redirects to the FRONTEND
// with the payment status as a query parameter.
//
// This two-hop redirect is necessary because SSLCommerz needs to redirect
// to your backend domain, but the user should end up on the frontend.
//
// The frontend's PaymentSection reads ?payment_status=VALID from the URL
// and triggers a data refresh + success toast.

import express    from "express";

const router = express.Router();

router.get("/success", (req, res) => {
  console.info("[Payment] SSLCommerz redirected to /payment/success");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=VALID`);
});

router.get("/failed", (req, res) => {
  console.info("[Payment] SSLCommerz redirected to /payment/failed");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=FAILED`);
});

router.get("/cancel", (req, res) => {
  console.info("[Payment] SSLCommerz redirected to /payment/cancel");
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?payment_status=CANCEL`);
});

export default router;