// server/services/sslCommerzService.js
//
// SSLCommerz integration — validation API call.
//
// Why a dedicated service file:
//   The validation API call is used by paymentCallback.
//   Keeping it isolated makes it easy to mock in tests
//   and easy to swap if the payment gateway changes.
//
// CRITICAL SECURITY NOTE:
//   Without calling the validation API, ANY attacker who discovers
//   your /api/payments/callback URL can POST fake payment data and
//   mark payments as completed without paying a single taka.
//   The validation API call is non-negotiable for production.

import axiosLib from "axios";

// ─── verifySSLCommerzPayment ──────────────────────────────────────────────────
// Calls the SSLCommerz validation API to confirm a payment is genuine.
//
// Parameters:
//   valId      — the val_id from the IPN callback body
//   tranId     — the tran_id (our transaction ID) for cross-referencing
//
// Returns: { isValid, validationData }
// Throws on network error — let the caller decide how to handle.

export const verifySSLCommerzPayment = async ({ valId, tranId }) => {
  const storeId   = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();

  const validationUrl = process.env.NODE_ENV === "production"
    ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
    : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

  const response = await axiosLib.get(validationUrl, {
    params: {
      val_id:      valId,
      store_id:    storeId,
      store_passwd: storePass,
      format:      "json",
    },
    timeout: 10000, // 10 second timeout for the validation call
  });

  const data         = response.data;
  const validStatuses = ["VALID", "VALIDATED"];
  const isValid      = validStatuses.includes(data?.status);

  // Cross-reference the transaction ID to prevent replay attacks
  // (using a valid val_id from payment A to confirm payment B)
  if (isValid && data.tran_id !== tranId) {
    return {
      isValid:        false,
      validationData: data,
      reason:         "Transaction ID mismatch — possible replay attack",
    };
  }

  return { isValid, validationData: data };
};