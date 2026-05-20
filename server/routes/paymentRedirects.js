import express from "express";
const router = express.Router();

router.get("/success", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Payment Successful</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0fdf4;">
        <h2 style="color:#16a34a;">✅ Payment Successful!</h2>
        <p style="color:#374151;">Your payment has been received successfully.</p>
        <p style="color:#374151;">Your account will be updated shortly.</p>
        <br/>
        <a 
          href="${frontendUrl}" 
          style="
            background:#16a34a;
            color:white;
            padding:12px 32px;
            border-radius:999px;
            text-decoration:none;
            font-weight:600;
            font-size:16px;
          "
        >
          Go to Homepage
        </a>
        <br/><br/>
        <p style="color:#9ca3af;font-size:13px;">
          Please log in again to see your updated payment status.
        </p>
      </body>
    </html>
  `);
});

router.get("/failed", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Payment Failed</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#fef2f2;">
        <h2 style="color:#dc2626;">❌ Payment Failed</h2>
        <p style="color:#555;">Please wait, redirecting you back...</p>
        <script>
          setTimeout(function() {
            window.location.href = '${frontendUrl}/dashboard?payment_status=FAILED';
          }, 1500);
        </script>
      </body>
    </html>
  `);
});

router.get("/cancel", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Payment Cancelled</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#fffbeb;">
        <h2 style="color:#d97706;">⚠️ Payment Cancelled</h2>
        <p style="color:#555;">Please wait, redirecting you back...</p>
        <script>
          setTimeout(function() {
            window.location.href = '${frontendUrl}/dashboard?payment_status=CANCEL';
          }, 1500);
        </script>
      </body>
    </html>
  `);
});

export default router;