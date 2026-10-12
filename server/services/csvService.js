// server/services/csvService.js
// CSV exports. One row = one payment / member / ledger line, so totals in a
// spreadsheet are always correct. Text cells are protected against formula injection.

import { Parser as Json2csvParser } from "json2csv";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "";



const fmtDateTime = (d) => {
  if (!d) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(new Date(d))
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

// A cell starting with = + - @ is executed as a formula by Excel/Sheets.
const safeText = (value) => {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

// Phones are validated digits (optionally +), so they cannot carry a formula.
const phoneText = (value) => {
  const s = String(value ?? "");
  return /^\+?\d{6,15}$/.test(s) ? s : safeText(s);
};

const toCsv = (fields, rows) =>
  rows.length === 0 ? fields.join(",") : new Json2csvParser({ fields }).parse(rows);

// ─── Member's own payment history (unchanged) ─────────────────────────────────

export const generateMemberCsv = ({ payments = [] }) => {
  const fields = [
    "Payment Date", "Receipt No", "Transaction ID", "Payment Received (BDT)",
    "Applied to Monthly Dues (BDT)", "Applied to Extra Charges (BDT)",
    "Added to Advance Credit (BDT)", "Covers",
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

// ─── Collection & Payments ────────────────────────────────────────────────────

export const generateAdminCsv = ({ payments = [] }) => {
  const fields = [
    "Payment Date", "Paid At (Dhaka time)", "Receipt No", "Transaction ID", "Membership No", "Member Name",
    "Payment Received (BDT)", "Applied to Monthly Dues (BDT)",
    "Applied to Extra Charges (BDT)", "Added to Advance Credit (BDT)", "Method",
  ];
  const rows = payments.map((p) => ({
    "Payment Date": fmtDate(p.paidAt),
    "Paid At (Dhaka time)": fmtDateTime(p.paidAt),
    "Receipt No": p.receiptNumber || "",
    "Transaction ID": safeText(p.transactionId),
    "Membership No": safeText(p.member?.membershipNo),
    "Member Name": safeText(p.member?.name),
    "Payment Received (BDT)": p.amount,
    "Applied to Monthly Dues (BDT)": p.monthlyApplied || 0,
    "Applied to Extra Charges (BDT)": p.extraApplied || 0,
    "Added to Advance Credit (BDT)": p.advanceAmount || 0,
    Method: p.gateway || "sslcommerz",
  }));
  return toCsv(fields, rows);
};

// ─── Member Directory ─────────────────────────────────────────────────────────

export const generateDirectoryCsv = ({ rows = [] }) => {
  const fields = [
    "Membership No", "Name", "Phone", "Email", "Designation", "Status",
    "Plots", "Total Area", "Plot Details", "Registered",
  ];
  return toCsv(
    fields,
    rows.map((r) => ({
      "Membership No": safeText(r.membershipNo),
      Name: safeText(r.name),
      Phone: phoneText(r.phone),
      Email: safeText(r.email),
      Designation: safeText(r.designation),
      Status: r.status,
      Plots: r.plotCount,
      "Total Area": r.totalArea,
      "Plot Details": safeText(r.plotsLabel),
      Registered: fmtDate(r.registeredAt),
    })),
  );
};

// ─── Outstanding Dues ─────────────────────────────────────────────────────────

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const generateOutstandingCsv = ({ rows = [] }) => {
  const fields = [
    "Membership No", "Member Name", "Phone", "Monthly Due (BDT)", "Extra Due (BDT)",
    "Total Due (BDT)", "Unpaid Months", "Oldest Due Month", "Credit Balance (BDT)",
  ];
  return toCsv(
    fields,
    rows.map((r) => ({
      "Membership No": safeText(r.membershipNo),
      "Member Name": safeText(r.name),
      Phone: phoneText(r.phone),
      "Monthly Due (BDT)": r.monthlyDue,
      "Extra Due (BDT)": r.extraDue,
      "Total Due (BDT)": r.totalDue,
      "Unpaid Months": r.unpaidMonths,
      "Oldest Due Month": r.oldestUnpaid ? `${MONTHS[r.oldestUnpaid.month]} ${r.oldestUnpaid.year}` : "",
      "Credit Balance (BDT)": r.creditBalance,
    })),
  );
};

// ─── Member Statement ─────────────────────────────────────────────────────────

export const generateStatementCsv = ({ rows = [], summary }) => {
  const fields = [
    "Date", "Description", "Charge (BDT)", "Cash Received (BDT)",
    "Credit Used (BDT)", "Due (BDT)", "Credit Balance (BDT)",
  ];
  const ledger = [
    {
      Date: fmtDate(summary.periodStart),
      Description: "Opening balance",
      "Charge (BDT)": "", "Cash Received (BDT)": "", "Credit Used (BDT)": "",
      "Due (BDT)": summary.openingDue,
      "Credit Balance (BDT)": summary.openingCredit,
    },
    ...rows.map((r) => ({
      Date: fmtDate(r.date),
      Description: safeText(r.description),
      "Charge (BDT)": r.charge || "",
      "Cash Received (BDT)": r.cash || "",
      "Credit Used (BDT)": r.creditUsed || "",
      "Due (BDT)": r.due,
      "Credit Balance (BDT)": r.creditBalance,
    })),
  ];
  return toCsv(fields, ledger);
};