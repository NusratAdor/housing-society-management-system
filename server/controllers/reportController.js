// server/controllers/reportController.js
//
// HTTP layer for report generation.
//
// CHANGE (this pass):
//   - Dates are YYYY-MM-DD in DHAKA time. The range is the first ms of the
//     start day to the last ms of the end day in Dhaka. (It used the server
//     timezone, so 00:00–06:00 Dhaka on the first day was missed and the
//     same hours after the last day were included.)
//   - Filenames use the requested date strings.
//   - paymentId is validated; 500 responses no longer leak internal messages.

import mongoose from "mongoose";
import Member from "../models/Member.js";
import {
  getMemberReportData,
  getAdminReportData,
  getSingleReceiptData,
  getMemberDirectoryData,
  getOutstandingDuesData,
  getMemberStatementData,
} from "../services/reportService.js";
import {
  drawReceipt,
  drawMemberReport,
  drawAdminReport,
   drawMemberDirectory,
  drawOutstandingReport,
  drawStatement,
} from "../services/pdfService.js";
import {
  generateMemberCsv,
  generateAdminCsv,
  generateDirectoryCsv,
  generateOutstandingCsv,
  generateStatementCsv,
} from "../services/csvService.js";
import { parseDateString, getDhakaDayBounds, getDhakaDateParts } from "../utils/dateTime.js";



// Messages that are safe to show to the client.
const isClientError = (message) =>
  ["Invalid", "must be", "cannot exceed"].some((m) => message.includes(m));

const sendReportError = (res, label, error) => {
  console.error(`${label} error:`, error.message);
  if (error.message.includes("not found")) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (isClientError(error.message)) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: "Server error" });
};

// ─── Shared date validation ───────────────────────────────────────────────────

const MAX_RANGE_DAYS = 366 * 5;

const parseDateRange = (startStr, endStr) => {
  const start = parseDateString(startStr);
  const end = parseDateString(endStr);

  if (!start) throw new Error("Invalid startDate (use YYYY-MM-DD)");
  if (!end) throw new Error("Invalid endDate (use YYYY-MM-DD)");

  const startDate = getDhakaDayBounds(start).start;
  const endDate = getDhakaDayBounds(end).end; // last ms of the end day, Dhaka

  if (startDate > endDate) throw new Error("startDate must be before endDate");

  if ((endDate - startDate) / (24 * 60 * 60 * 1000) > MAX_RANGE_DAYS) {
    throw new Error("Date range cannot exceed 5 years");
  }

  return { startDate, endDate, rangeLabel: `${startStr}-${endStr}` };
};

const sendFile = (res, { contentType, filename, body }) => {
  res.set({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    ...(Buffer.isBuffer(body) ? { "Content-Length": body.length } : {}),
  });
  return res.send(body);
};

// ─── GET /api/reports/me/receipt/:paymentId ───────────────────────────────────

export const downloadMemberReceipt = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.paymentId)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data = await getSingleReceiptData({
      paymentId: req.params.paymentId,
      memberId: member._id,
    });

    const pdfBuffer = await drawReceipt(data);
    const safeReceipt = (data.payment.receiptNumber || "receipt").replace(
      /[^A-Za-z0-9-]/g,
      "-",
    );

    return sendFile(res, {
      contentType: "application/pdf",
      filename: `${safeReceipt}.pdf`,
      body: pdfBuffer,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("Receipts can only")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return sendReportError(res, "downloadMemberReceipt", error);
  }
};

// ─── GET /api/reports/me/pdf ──────────────────────────────────────────────────

export const downloadMemberPdf = async (req, res) => {
  try {
    const { startDate, endDate, rangeLabel } = parseDateRange(
      req.query.startDate,
      req.query.endDate,
    );

    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data = await getMemberReportData({ memberId: member._id, startDate, endDate });
    const pdfBuffer = await drawMemberReport(data);

    return sendFile(res, {
      contentType: "application/pdf",
      filename: `payment-history-${member.membershipNo}-${rangeLabel}.pdf`,
      body: pdfBuffer,
    });
  } catch (error) {
    return sendReportError(res, "downloadMemberPdf", error);
  }
};

// ─── GET /api/reports/me/csv ──────────────────────────────────────────────────

export const downloadMemberCsv = async (req, res) => {
  try {
    const { startDate, endDate, rangeLabel } = parseDateRange(
      req.query.startDate,
      req.query.endDate,
    );

    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data = await getMemberReportData({ memberId: member._id, startDate, endDate });
    const csvText = generateMemberCsv(data);

    // UTF-8 BOM so Excel opens the file with the right encoding.
    return sendFile(res, {
      contentType: "text/csv; charset=utf-8",
      filename: `payment-history-${member.membershipNo}-${rangeLabel}.csv`,
      body: "\uFEFF" + csvText,
    });
  } catch (error) {
    return sendReportError(res, "downloadMemberCsv", error);
  }
};

// ─── GET /api/reports/admin/pdf ───────────────────────────────────────────────

export const downloadAdminPdf = async (req, res) => {
  try {
    const { startDate, endDate, rangeLabel } = parseDateRange(
      req.query.startDate,
      req.query.endDate,
    );

    const data = await getAdminReportData({ startDate, endDate });
    const pdfBuffer = await drawAdminReport(data);

    return sendFile(res, {
      contentType: "application/pdf",
      filename: `collection-report-${rangeLabel}.pdf`,
      body: pdfBuffer,
    });
  } catch (error) {
    return sendReportError(res, "downloadAdminPdf", error);
  }
};

// ─── GET /api/reports/admin/csv ───────────────────────────────────────────────

export const downloadAdminCsv = async (req, res) => {
  try {
    const { startDate, endDate, rangeLabel } = parseDateRange(
      req.query.startDate,
      req.query.endDate,
    );

    const data = await getAdminReportData({ startDate, endDate });
    const csvText = generateAdminCsv(data);

    return sendFile(res, {
      contentType: "text/csv; charset=utf-8",
      filename: `collection-report-${rangeLabel}.csv`,
      body: "\uFEFF" + csvText,
    });
  } catch (error) {
    return sendReportError(res, "downloadAdminCsv", error);
  }
};



// ─── Admin reports: one handler for all four ──────────────────────────────────
// GET /api/reports/admin/<report>?format=json|pdf|csv  (+ startDate/endDate/status)

const JSON_ROW_LIMIT = 1000; // preview only; PDF and CSV are always complete

const todayLabel = () => {
  const { year, month, day } = getDhakaDateParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const REPORTS = {
  directory: {
    load: (req) =>
      getMemberDirectoryData({
        status: ["active", "removed", "all"].includes(req.query.status) ? req.query.status : "active",
      }),
    pdf: drawMemberDirectory,
    csv: generateDirectoryCsv,
    filename: () => `member-directory-${todayLabel()}`,
    json: (d) => d,
  },
  collection: {
    range: true,
    load: (req, range) => getAdminReportData(range),
    pdf: drawAdminReport,
    csv: generateAdminCsv,
    filename: (d, range) => `collection-report-${range.rangeLabel}`,
    json: (d) => ({
      summary: d.summary,
      truncated: d.payments.length > JSON_ROW_LIMIT,
      payments: d.payments.slice(0, JSON_ROW_LIMIT).map((p) => ({
        _id: p._id,
        paidAt: p.paidAt,
        receiptNumber: p.receiptNumber,
        amount: p.amount,
        advanceAmount: p.advanceAmount,
        monthlyApplied: p.monthlyApplied,
        extraApplied: p.extraApplied,
        member: { name: p.member?.name, membershipNo: p.member?.membershipNo },
      })),
    }),
  },
  outstanding: {
    load: () => getOutstandingDuesData(),
    pdf: drawOutstandingReport,
    csv: generateOutstandingCsv,
    filename: () => `outstanding-dues-${todayLabel()}`,
    json: (d) => d,
  },
  statement: {
    range: true,
    load: (req, range) =>
      getMemberStatementData({
        memberId: req.params.memberId,
        startDate: range.startDate,
        endDate: range.endDate,
      }),
    pdf: drawStatement,
    csv: generateStatementCsv,
    filename: (d, range) => `statement-${d.member.membershipNo}-${range.rangeLabel}`,
    json: (d) => d,
  },
};

export const serveAdminReport = (key) => async (req, res) => {
  try {
    const report = REPORTS[key];
    const format = typeof req.query.format === "string" ? req.query.format : "json";

    if (!["json", "pdf", "csv"].includes(format)) {
      return res.status(400).json({ success: false, message: "Invalid format" });
    }

    const range = report.range
      ? parseDateRange(req.query.startDate, req.query.endDate)
      : null;

    const data = await report.load(req, range);
    const base = report.filename(data, range);

    if (format === "pdf") {
      return sendFile(res, {
        contentType: "application/pdf",
        filename: `${base}.pdf`,
        body: await report.pdf(data),
      });
    }
    if (format === "csv") {
      return sendFile(res, {
        contentType: "text/csv; charset=utf-8",
        filename: `${base}.csv`,
        body: "\uFEFF" + report.csv(data),
      });
    }

    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, ...report.json(data) });
  } catch (error) {
    return sendReportError(res, `adminReport:${key}`, error);
  }
};