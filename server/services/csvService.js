// server/services/csvService.js
//
// Generates CSV strings from report data.
// Uses the json2csv library for correct quoting and escaping.
// Returns a string (not a file) — the controller sets headers and sends it.

import { Parser as Json2csvParser } from "json2csv";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB") : "";

const MONTH_NAMES = [
  "", "January", "February", "March", "April",
  "May", "June", "July", "August", "September",
  "October", "November", "December",
];

// ─── generateMemberCsv ────────────────────────────────────────────────────────
// One row per payment allocation (not per payment).
// This gives the most granular view — each charge on its own row.
// Member info is repeated on each row for easy filtering in Excel.

export const generateMemberCsv = ({ member, payments, summary }) => {
  const rows = [];

  for (const payment of payments) {
    if (payment.breakdown.length === 0) {
      // No allocation data available — output one summary row
      rows.push({
        "Member Name":       member.name,
        "Membership No":     member.membershipNo,
        "Plot No":           member.plotNo,
        "Email":             member.email,
        "Receipt Number":    payment.receiptNumber || "",
        "Transaction ID":    payment.transactionId,
        "Payment Date":      fmtDate(payment.paidAt),
        "Charge Type":       "",
        "Description":       "Payment",
        "Amount (BDT)":      payment.amount,
        "Payment Total (BDT)": payment.amount,
        "Status":            payment.status,
      });
    } else {
      for (const item of payment.breakdown) {
        rows.push({
          "Member Name":       member.name,
          "Membership No":     member.membershipNo,
          "Plot No":           member.plotNo,
          "Email":             member.email,
          "Receipt Number":    payment.receiptNumber || "",
          "Transaction ID":    payment.transactionId,
          "Payment Date":      fmtDate(payment.paidAt),
          "Charge Type":       item.type === "monthly" ? "Monthly Dues" : "Extra Charge",
          "Description":       item.description,
          "Amount (BDT)":      item.amount,
          "Payment Total (BDT)": payment.amount,
          "Status":            payment.status,
        });
      }
    }
  }

  // Append summary row at the bottom
  rows.push({});
  rows.push({
    "Member Name":         "PERIOD SUMMARY",
    "Membership No":       "",
    "Plot No":             "",
    "Email":               "",
    "Receipt Number":      "",
    "Transaction ID":      "",
    "Payment Date":        `${fmtDate(summary.periodStart)} to ${fmtDate(summary.periodEnd)}`,
    "Charge Type":         "",
    "Description":         "Total Paid",
    "Amount (BDT)":        summary.totalPaid,
    "Payment Total (BDT)": summary.totalPaid,
    "Status":              "",
  });

  if (rows.length === 0) {
    return "No completed payments in this period.";
  }

  const parser = new Json2csvParser({ fields: Object.keys(rows[0] || {}) });
  return parser.parse(rows);
};

// ─── generateAdminCsv ─────────────────────────────────────────────────────────
// One row per payment across all members.
// Suitable for importing into accounting software.

export const generateAdminCsv = ({ payments, summary }) => {
  const rows = payments.map(payment => ({
    "Date":           fmtDate(payment.paidAt),
    "Receipt No":     payment.receiptNumber || "",
    "Transaction ID": payment.transactionId,
    "Member Name":    payment.member?.name         || "—",
    "Membership No":  payment.member?.membershipNo || "—",
    "Plot No":        payment.member?.plotNo        || "—",
    "Email":          payment.member?.email         || "—",
    "Amount (BDT)":   payment.amount,
    "Gateway":        payment.gateway || "sslcommerz",
    "Status":         payment.status,
  }));

  // Summary rows
  rows.push({});
  rows.push({
    "Date":           "PERIOD TOTAL",
    "Receipt No":     "",
    "Transaction ID": "",
    "Member Name":    `${summary.membersWhoPayd} members`,
    "Membership No":  "",
    "Plot No":        "",
    "Email":          `${fmtDate(summary.periodStart)} — ${fmtDate(summary.periodEnd)}`,
    "Amount (BDT)":   summary.totalCollection,
    "Gateway":        "",
    "Status":         `${summary.totalPayments} payments`,
  });

  if (payments.length === 0) {
    return "No completed payments in this period.";
  }

  const fields = [
    "Date", "Receipt No", "Transaction ID", "Member Name",
    "Membership No", "Plot No", "Email", "Amount (BDT)", "Gateway", "Status",
  ];
  const parser = new Json2csvParser({ fields });
  return parser.parse(rows);
};