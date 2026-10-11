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
} from "../services/reportService.js";
import {
  drawReceipt,
  drawMemberReport,
  drawAdminReport,
} from "../services/pdfService.js";
import {
  generateMemberCsv,
  generateAdminCsv,
} from "../services/csvService.js";
import { parseDateString, getDhakaDayBounds } from "../utils/dateTime.js";

// Messages that are safe to show to the client.
const isClientError = (message) =>
  ["Invalid", "must be", "cannot exceed"].some((m) => message.includes(m));

const sendReportError = (res, label, error) => {
  console.error(`${label} error:`, error.message);
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