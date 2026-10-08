// server/controllers/memberSeatController.js
//
// HTTP controller for MemberSeat administration.
//
// Responsibilities:
//   - Read req.
//   - Validate basic HTTP input.
//   - Parse CSV upload.
//   - Call memberSeatImportService.
//   - Send HTTP response.
//
// Business rules belong in:
//   - memberSeatImportService.js
//   - memberSeatService.js
//
// This controller deliberately contains NO row-by-row CSV database logic.

import MemberSeat from "../models/MemberSeat.js";
import {
  normalizePhone,
  isValidPhone,
} from "../utils/phoneUtils.js";
import { importMemberSeats } from "../services/memberSeatImportService.js";
import { getDhakaDateParts } from "../utils/dateTime.js";

const PAID_THROUGH_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])$/;

const MEMBERSHIP_NO_PATTERN = /^\d+$/;

const MAX_CSV_ROWS = 5000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const normalizeMembershipNo = (value) => {
  return String(value ?? "").trim();
};

const normalizePaidThroughMonth = (value) => {
  return String(value ?? "").trim();
};

const getCurrentMonth = () => {
  const { year, month } = getDhakaDateParts();

  return `${year}-${String(month).padStart(2, "0")}`;
};

const isFuturePaidThroughMonth = (value) => {
  return value > getCurrentMonth();
};

// CSV fields are intentionally simple:
//
// membershipNo,phone,paidThroughMonth
//
// None of these fields should contain commas, so a small parser is
// sufficient and avoids bringing a full CSV dependency into the
// request path.

const parseCSV = (text) => {
  const normalizedText = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalizedText) {
    return {
      headers: [],
      rows: [],
    };
  }

  const lines = normalizedText
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return {
      headers: lines[0]
        ? lines[0].split(",").map((h) => h.trim())
        : [],
      rows: [],
    };
  }

  const headers = lines[0]
    .split(",")
    .map((header) =>
      header
        .replace(/^\uFEFF/, "")
        .trim(),
    );

  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = lines[index]
      .split(",")
      .map((value) => value.trim());

    const row = {};

    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] ?? "";
    });

    rows.push(row);
  }

  return {
    headers,
    rows,
  };
};

const validateCSVHeaders = (headers) => {
  const normalized = new Set(
    headers.map((header) =>
      String(header)
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
    ),
  );

  const required = [
    "membershipno",
    "phone",
    "paidthroughmonth",
  ];

  return required.filter(
    (header) => !normalized.has(header),
  );
};

// ─── GET /api/admin/seats ──────────────────────────────────────────────────

export const getAllSeats = async (req, res) => {
  try {
    const seats = await MemberSeat.find({})
      .select(
        "membershipNo registeredPhone paidThroughMonth " +
          "joinDate isClaimed claimedAt isRetired retiredAt",
      )
      .sort({ membershipNo: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      seats,
    });
  } catch (error) {
    console.error(
      "getAllSeats error:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load member seats",
    });
  }
};

// ─── POST /api/admin/seats ─────────────────────────────────────────────────

export const createSeat = async (req, res) => {
  try {
    const {
      membershipNo,
      phone,
      paidThroughMonth,
    } = req.body;

    const normalizedMembershipNo =
      normalizeMembershipNo(membershipNo);

    const normalizedPaidThroughMonth =
      normalizePaidThroughMonth(paidThroughMonth);

    if (
      !normalizedMembershipNo ||
      !MEMBERSHIP_NO_PATTERN.test(
        normalizedMembershipNo,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Membership number must contain digits only",
      });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    let normalizedPhone;

    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      normalizedPhone = null;
    }

    if (
      !normalizedPhone ||
      !isValidPhone(normalizedPhone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    if (
      !PAID_THROUGH_PATTERN.test(
        normalizedPaidThroughMonth,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "paidThroughMonth must be in YYYY-MM format",
      });
    }

    if (
      isFuturePaidThroughMonth(
        normalizedPaidThroughMonth,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "paidThroughMonth cannot be in the future",
      });
    }

    const existing = await MemberSeat.findOne({
      membershipNo: normalizedMembershipNo,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          existing.isRetired
            ? "This membership number is retired and cannot be reused"
            : "A seat already exists for this membership number",
      });
    }

    const seat = await MemberSeat.create({
      membershipNo: normalizedMembershipNo,
      registeredPhone: normalizedPhone,
      paidThroughMonth:
        normalizedPaidThroughMonth,
      isClaimed: false,
      isRetired: false,
    });

    return res.status(201).json({
      success: true,
      message: "Member seat created",
      seat,
    });
  } catch (error) {
    console.error(
      "createSeat error:",
      error.message,
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A seat already exists for this membership number",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create member seat",
    });
  }
};

// ─── PUT /api/admin/seats/:id ──────────────────────────────────────────────
//
// Claimed seats are completely immutable.
//
// If an admin needs to change the member's current phone,
// that belongs to Member.phone — NOT MemberSeat.registeredPhone.

export const updateSeat = async (req, res) => {
  try {
    const { id } = req.params;

    const seat = await MemberSeat.findById(id);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: "Member seat not found",
      });
    }

    if (seat.isRetired) {
      return res.status(400).json({
        success: false,
        message:
          "Retired seats cannot be edited",
      });
    }

    if (seat.isClaimed) {
      return res.status(400).json({
        success: false,
        message:
          "Claimed seats are locked and cannot be edited",
      });
    }

    const {
      membershipNo,
      phone,
      paidThroughMonth,
    } = req.body;

    const normalizedMembershipNo =
      normalizeMembershipNo(membershipNo);

    const normalizedPaidThroughMonth =
      normalizePaidThroughMonth(paidThroughMonth);

    if (
      !normalizedMembershipNo ||
      !MEMBERSHIP_NO_PATTERN.test(
        normalizedMembershipNo,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Membership number must contain digits only",
      });
    }

    let normalizedPhone;

    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      normalizedPhone = null;
    }

    if (
      !normalizedPhone ||
      !isValidPhone(normalizedPhone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    if (
      !PAID_THROUGH_PATTERN.test(
        normalizedPaidThroughMonth,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "paidThroughMonth must be in YYYY-MM format",
      });
    }

    if (
      isFuturePaidThroughMonth(
        normalizedPaidThroughMonth,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "paidThroughMonth cannot be in the future",
      });
    }

    const membershipConflict =
      await MemberSeat.findOne({
        membershipNo: normalizedMembershipNo,
        _id: { $ne: seat._id },
      }).select("_id isRetired");

    if (membershipConflict) {
      return res.status(409).json({
        success: false,
        message:
          "Another seat already uses this membership number",
      });
    }

    seat.membershipNo = normalizedMembershipNo;
    seat.registeredPhone = normalizedPhone;
    seat.paidThroughMonth =
      normalizedPaidThroughMonth;

    await seat.save();

    return res.status(200).json({
      success: true,
      message: "Member seat updated",
      seat,
    });
  } catch (error) {
    console.error(
      "updateSeat error:",
      error.message,
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Another seat already uses this membership number",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update member seat",
    });
  }
};

// ─── DELETE /api/admin/seats/:id ───────────────────────────────────────────

export const deleteSeat = async (req, res) => {
  try {
    const { id } = req.params;

    const seat = await MemberSeat.findById(id);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: "Member seat not found",
      });
    }

    if (seat.isClaimed) {
      return res.status(400).json({
        success: false,
        message:
          "Claimed seats cannot be deleted",
      });
    }

    if (seat.isRetired) {
      return res.status(400).json({
        success: false,
        message:
          "Retired seats cannot be deleted",
      });
    }

    await MemberSeat.deleteOne({
      _id: seat._id,
    });

    return res.status(200).json({
      success: true,
      message: "Member seat deleted",
    });
  } catch (error) {
    console.error(
      "deleteSeat error:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete member seat",
    });
  }
};

// ─── POST /api/admin/seats/import ──────────────────────────────────────────

export const importSeatsFromCSV = async (
  req,
  res,
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const text = req.file.buffer.toString("utf8");

    const { headers, rows } = parseCSV(text);

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV contains no data rows",
      });
    }

    if (rows.length > MAX_CSV_ROWS) {
      return res.status(400).json({
        success: false,
        message:
          `CSV cannot contain more than ${MAX_CSV_ROWS} rows`,
      });
    }

    const missingHeaders =
      validateCSVHeaders(headers);

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `Missing required CSV columns: ${missingHeaders.join(
            ", ",
          )}`,
      });
    }

    const result = await importMemberSeats({
      rows,
      performedBy:
        req.auth?.userId ||
        req.user?.id ||
        "UNKNOWN_ADMIN",
    });

    // Validation errors mean nothing was imported.
    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "CSV validation failed. No changes were made.",
        results: result,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Member seat import completed",
      results: result,
    });
  } catch (error) {
    console.error(
      "importSeatsFromCSV error:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to import member seats",
    });
  }
};