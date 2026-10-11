// server/services/csvService.js
//
// CSV exports for accounting use.
//
// CHANGE (this pass):
//   - ONE ROW = ONE PAYMENT. SUM("Payment Received") is always the true
//     cash collected. The old per-charge rows repeated the payment total.
//   - No fake summary row inside the data.
//   - Dates are ISO (YYYY-MM-DD, Dhaka time): unambiguous in Excel.
//   - Text cells are protected against spreadsheet formula injection
//     (names and charge labels are user/admin-entered).
//   - An empty result is a valid header-only CSV.

import { Parser as Json2csvParser } from "json2csv";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "";

// A cell starting with = + - @ is executed as a formula by Excel/Sheets.
const safeText = (value) => {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

const toCsv = (fields, rows) => {
  if (rows.length === 0) return fields.join(",");
  return new Json2csvParser({ fields }).parse(rows);
};

// ─── generateMemberCsv ────────────────────────────────────────────────────────

export const generateMemberCsv = ({ payments = [] }) => {
  const fields = [
    "Payment Date",
    "Receipt No",
    "Transaction ID",
    "Payment Received (BDT)",
    "Applied to Monthly Dues (BDT)",
    "Applied to Extra Charges (BDT)",
    "Added to Advance Credit (BDT)",
    "Covers",
  ];

  const rows = payments.map((p) => ({
    "Payment Date": fmtDate(p.paidAt),
    "Receipt No": p.receiptNumber || "",
    "Transaction ID": safeText(p.transactionId),
    "Payment Received (BDT)": p.amount,
    "Applied to Monthly Dues (BDT)": p.monthlyApplied || 0,
    "Applied to Extra Charges (BDT)": p.extraApplied || 0,
    "Added to Advance Credit (BDT)": p.advanceAmount || 0,
    Covers: safeText(p.covers),
  }));

  return toCsv(fields, rows);
};

// ─── generateAdminCsv ─────────────────────────────────────────────────────────

export const generateAdminCsv = ({ payments = [] }) => {
  const fields = [
    "Payment Date",
    "Receipt No",
    "Transaction ID",
    "Membership No",
    "Member Name",
    "Payment Received (BDT)",
    "Applied to Dues (BDT)",
    "Added to Advance Credit (BDT)",
    "Method",
  ];

  const rows = payments.map((p) => {
    const advance = p.advanceAmount || 0;
    return {
      "Payment Date": fmtDate(p.paidAt),
      "Receipt No": p.receiptNumber || "",
      "Transaction ID": safeText(p.transactionId),
      "Membership No": safeText(p.member?.membershipNo),
      "Member Name": safeText(p.member?.name),
      "Payment Received (BDT)": p.amount,
      "Applied to Dues (BDT)": p.amount - advance,
      "Added to Advance Credit (BDT)": advance,
      Method: p.gateway || "sslcommerz",
    };
  });

  return toCsv(fields, rows);
};