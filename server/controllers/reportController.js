// server/controllers/reportController.js
//
// HTTP layer for report generation.
// Each endpoint:
//   1. Validates the date range and member ownership
//   2. Calls the appropriate reportService function to get data
//   3. Calls pdfService or csvService to format the data
//   4. Sets correct Content-Type and Content-Disposition headers
//   5. Sends the binary buffer or CSV string

import Member     from "../models/Member.js";
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

// ─── Shared date validation ────────────────────────────────────────────────────

const parseDateRange = (startStr, endStr) => {
  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);

  if (isNaN(startDate.getTime())) throw new Error("Invalid startDate");
  if (isNaN(endDate.getTime()))   throw new Error("Invalid endDate");
  if (startDate > endDate)        throw new Error("startDate must be before endDate");

  // Prevent absurdly large ranges (> 5 years) that would be very slow
  const diffMs    = endDate - startDate;
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365);
  if (diffYears > 5) throw new Error("Date range cannot exceed 5 years");

  return { startDate, endDate };
};

// ─── GET /api/reports/me/receipt/:paymentId ───────────────────────────────────
// Member downloads receipt for one specific payment.

export const downloadMemberReceipt = async (req, res) => {
  try {
    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data = await getSingleReceiptData({
      paymentId: req.params.paymentId,
      memberId:  member._id,
    });

    const pdfBuffer = await drawReceipt(data);

    const safeReceipt = (data.payment.receiptNumber || "receipt").replace(/[^A-Za-z0-9-]/g, "-");

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${safeReceipt}.pdf"`,
      "Content-Length":      pdfBuffer.length,
      "Cache-Control":       "no-store",
    });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("downloadMemberReceipt error:", error.message);
    const status = error.message.includes("not found") ? 404
      : error.message.includes("Receipts can only") ? 400
      : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// ─── GET /api/reports/me/pdf ──────────────────────────────────────────────────
// Member downloads their transaction history as PDF.
// Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)

export const downloadMemberPdf = async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(
      req.query.startDate, req.query.endDate
    );

    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data = await getMemberReportData({
      memberId: member._id,
      startDate,
      endDate,
    });

    const pdfBuffer = await drawMemberReport(data);

    const filename =
      `payment-history-${member.membershipNo}-` +
      `${startDate.toISOString().slice(0, 10)}-` +
      `${endDate.toISOString().slice(0, 10)}.pdf`;

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      pdfBuffer.length,
      "Cache-Control":       "no-store",
    });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("downloadMemberPdf error:", error.message);
    const status = ["Invalid", "must be"].some(m => error.message.includes(m)) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// ─── GET /api/reports/me/csv ──────────────────────────────────────────────────
// Member downloads their transaction history as CSV.
// Query params: startDate, endDate

export const downloadMemberCsv = async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(
      req.query.startDate, req.query.endDate
    );

    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const data    = await getMemberReportData({ memberId: member._id, startDate, endDate });
    const csvText = generateMemberCsv(data);

    const filename =
      `payment-history-${member.membershipNo}-` +
      `${startDate.toISOString().slice(0, 10)}-` +
      `${endDate.toISOString().slice(0, 10)}.csv`;

    res.set({
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    });
    // UTF-8 BOM — makes Excel open the file correctly without encoding issues
    return res.send("\uFEFF" + csvText);
  } catch (error) {
    console.error("downloadMemberCsv error:", error.message);
    const status = ["Invalid", "must be"].some(m => error.message.includes(m)) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// ─── GET /api/reports/admin/pdf ───────────────────────────────────────────────
// Admin downloads society-wide collection report as PDF.
// Query params: startDate, endDate

export const downloadAdminPdf = async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(
      req.query.startDate, req.query.endDate
    );

    const data      = await getAdminReportData({ startDate, endDate });
    const pdfBuffer = await drawAdminReport(data);

    const filename =
      `collection-report-` +
      `${startDate.toISOString().slice(0, 10)}-` +
      `${endDate.toISOString().slice(0, 10)}.pdf`;

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      pdfBuffer.length,
      "Cache-Control":       "no-store",
    });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("downloadAdminPdf error:", error.message);
    const status = ["Invalid", "must be"].some(m => error.message.includes(m)) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// ─── GET /api/reports/admin/csv ───────────────────────────────────────────────
// Admin downloads all payments as CSV.
// Query params: startDate, endDate

export const downloadAdminCsv = async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(
      req.query.startDate, req.query.endDate
    );

    const data    = await getAdminReportData({ startDate, endDate });
    const csvText = generateAdminCsv(data);

    const filename =
      `collection-report-` +
      `${startDate.toISOString().slice(0, 10)}-` +
      `${endDate.toISOString().slice(0, 10)}.csv`;

    res.set({
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    });
    return res.send("\uFEFF" + csvText);
  } catch (error) {
    console.error("downloadAdminCsv error:", error.message);
    const status = ["Invalid", "must be"].some(m => error.message.includes(m)) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};