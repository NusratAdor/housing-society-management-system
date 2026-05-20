import express from "express";
const router = express.Router();

router.get("/success", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Successful</title>
        <meta http-equiv="refresh" content="0">
      </head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;">
        <h2 style="color:green;">✅ Payment Successful!</h2>
        <p>Redirecting you back...</p>
        <script>
          // Clear any broken clerk state first
          try {
            localStorage.clear();
          } catch(e) {}
          
          // Use window.open to force a fresh navigation
          // This breaks the SSLCommerz → Clerk redirect chain
          setTimeout(function() {
            window.location.href = '${frontendUrl}/dashboard?payment_status=VALID&t=' + Date.now();
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
      <body style="font-family:sans-serif;text-align:center;padding:50px;">
        <h2 style="color:red;">❌ Payment Failed</h2>
        <p>Redirecting you back...</p>
        <script>
          setTimeout(function() {
            window.location.href = '${frontendUrl}/dashboard?payment_status=FAILED&t=' + Date.now();
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
      <body style="font-family:sans-serif;text-align:center;padding:50px;">
        <h2 style="color:orange;">⚠️ Payment Cancelled</h2>
        <p>Redirecting you back...</p>
        <script>
          setTimeout(function() {
            window.location.href = '${frontendUrl}/dashboard?payment_status=CANCEL&t=' + Date.now();
          }, 1500);
        </script>
      </body>
    </html>
  `);
});

export default router;