// server/routes/testRoutes.js  (temporary — delete after fixing)
import express from "express";
import axiosLib from "axios";

const router = express.Router();

router.get("/test-payment", async (req, res) => {
  const storeId   = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();

  const params = new URLSearchParams();
  params.append("store_id",         storeId);
  params.append("store_passwd",     storePass);
  params.append("total_amount",     "100.00");
  params.append("currency",         "BDT");
  params.append("tran_id",          `TEST-${Date.now()}`);
  params.append("success_url",      `${process.env.BACKEND_URL}/payment/success`);
  params.append("fail_url",         `${process.env.BACKEND_URL}/payment/failed`);
  params.append("cancel_url",       `${process.env.BACKEND_URL}/payment/cancel`);
  params.append("ipn_url",          `${process.env.BACKEND_URL}/api/payments/callback`);
  params.append("product_name",     "Test");
  params.append("product_category", "Test");
  params.append("product_profile",  "general");
  params.append("shipping_method",  "NO");
  params.append("num_of_item",      "1");
  params.append("cus_name",         "Test User");
  params.append("cus_email",        "test@test.com");
  params.append("cus_phone",        "01700000000");
  params.append("cus_add1",         "Dhaka");
  params.append("cus_city",         "Dhaka");
  params.append("cus_country",      "Bangladesh");

  try {
    const response = await axiosLib.post(
      "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );
    return res.json({ success: true, data: response.data });
  } catch (error) {
    return res.json({
      success: false,
      status:  error.response?.status,
      data:    error.response?.data,
      message: error.message,
    });
  }
});

export default router;