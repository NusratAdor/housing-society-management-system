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
        <p style="color:#555;">Please wait, redirecting you back...</p>
        <script>
          setTimeout(function() {
            window.location.href = '${frontendUrl}/dashboard?payment_status=VALID';
          }, 1500);
        </script>
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