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
//
// CHANGE (this pass): verifySSLCommerzPayment now also requires
// expectedAmount, and cross-checks it against the amount SSLCommerz's
// Validation API actually confirms was paid. Without this check, the
// function only verified WHO paid and THAT a payment happened — never
// HOW MUCH. SSLCommerz's own integration guidance calls this out
// specifically: the validation response's amount/currency must be
// checked against your expected order amount, since this is the step
// that would catch tampering during the checkout redirect (the amount
// sent to the gateway at session-creation could, in principle, differ
// from what the gateway ultimately reports as paid). A small floating-
// point tolerance is used since gateway amounts are returned as
// strings and can carry minor formatting differences.

import axiosLib from "axios";

const AMOUNT_TOLERANCE = 0.01; // BDT — accounts for string/float formatting only

// ─── verifySSLCommerzPayment ──────────────────────────────────────────────────
// Calls the SSLCommerz validation API to confirm a payment is genuine.
//
// Parameters:
//   valId          — the val_id from the IPN callback body
//   tranId         — the tran_id (our transaction ID) for cross-referencing
//   expectedAmount — the amount (BDT) our system expects this payment to
//                    have been for, from our own Payment record — REQUIRED.
//
// Returns: { isValid, validationData, reason? }
// Throws on network error — let the caller decide how to handle.

export const verifySSLCommerzPayment = async ({ valId, tranId, expectedAmount }) => {
  if (expectedAmount === undefined || expectedAmount === null) {
    // Fail closed — a missing expected amount must never be treated as
    // "skip the check". This should only ever happen from a programming
    // error at the call site, never in normal operation.
    throw new Error("verifySSLCommerzPayment requires expectedAmount");
  }

  const storeId   = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePass = process.env.SSLCOMMERZ_STORE_PASS?.trim();

  const isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";
  const validationUrl = isLive
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

  const data          = response.data;
  const validStatuses = ["VALID", "VALIDATED"];
  const statusIsValid = validStatuses.includes(data?.status);

  if (!statusIsValid) {
    return { isValid: false, validationData: data };
  }

  // Cross-reference the transaction ID to prevent replay attacks
  // (using a valid val_id from payment A to confirm payment B)
  if (data.tran_id !== tranId) {
    return {
      isValid:        false,
      validationData: data,
      reason:         "Transaction ID mismatch — possible replay attack",
    };
  }

  // Cross-reference the confirmed amount against what we expect this
  // payment to be for. "amount" in SSLCommerz's response is the
  // customer-paid transaction amount (not store_amount, which is net
  // of gateway fees — the wrong field to compare against our order total).
  const confirmedAmount = Number(data.amount);
  if (!Number.isFinite(confirmedAmount)) {
    return {
      isValid:        false,
      validationData: data,
      reason:         "Validation response did not include a valid amount",
    };
  }

  const amountDiff = Math.abs(confirmedAmount - Number(expectedAmount));
  if (amountDiff > AMOUNT_TOLERANCE) {
    return {
      isValid:        false,
      validationData: data,
      reason:         `Amount mismatch — expected ৳${expectedAmount}, gateway confirmed ৳${confirmedAmount}`,
    };
  }

  // Currency check — this system only ever deals in BDT.
  if (data.currency_type && data.currency_type !== "BDT") {
    return {
      isValid:        false,
      validationData: data,
      reason:         `Unexpected currency: ${data.currency_type}`,
    };
  }

  return { isValid: true, validationData: data };
};