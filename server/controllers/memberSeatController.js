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

import { writeAuditLog } from "../services/auditService.js";
import { runInTransactionWithRetry } from "../utils/transactionRetry.js";
import { httpError } from "../utils/httpError.js";

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

const sendSeatError = (res, label, error, fallback) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A seat already exists for this membership number",
    });
  }
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ success: false, message: fallback });
};

const parseSeatInput = ({ membershipNo, phone, paidThroughMonth }) => {
  const number = normalizeMembershipNo(membershipNo);
  const paidThrough = normalizePaidThroughMonth(paidThroughMonth);

  if (!number || !MEMBERSHIP_NO_PATTERN.test(number)) {
    return { error: "Membership number must contain digits only" };
  }
  if (!phone || !String(phone).trim()) return { error: "Phone number is required" };

  let normalizedPhone = null;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch {
    normalizedPhone = null;
  }
  if (!normalizedPhone || !isValidPhone(normalizedPhone)) return { error: "Invalid phone number" };

  if (!PAID_THROUGH_PATTERN.test(paidThrough)) {
    return { error: "paidThroughMonth must be in YYYY-MM format" };
  }
  if (isFuturePaidThroughMonth(paidThrough)) {
    return { error: "paidThroughMonth cannot be in the future" };
  }

  return { membershipNo: number, phone: normalizedPhone, paidThroughMonth: paidThrough };
};

// ─── POST /api/admin/seats ───────────────────────────────────────────────────
// The registered phone is a registration credential: it is never written to the audit log.

export const createSeat = async (req, res) => {
  try {
    const input = parseSeatInput(req.body ?? {});
    if (input.error) return res.status(400).json({ success: false, message: input.error });

    const seat = await runInTransactionWithRetry(async (session) => {
      const existing = await MemberSeat.findOne({ membershipNo: input.membershipNo }).session(session);

      if (existing) {
        throw httpError(
          409,
          existing.isRetired
            ? "This membership number is retired and cannot be reused"
            : "A seat already exists for this membership number",
        );
      }

      const [created] = await MemberSeat.create(
        [
          {
            membershipNo: input.membershipNo,
            registeredPhone: input.phone,
            paidThroughMonth: input.paidThroughMonth,
            isClaimed: false,
            isRetired: false,
          },
        ],
        { session },
      );

      await writeAuditLog({
        action: "SEAT_CREATED",
        performedBy: req.clerkUserId,
        targetId: created._id,
        description: `Member seat ${created.membershipNo} created`,
        after: { membershipNo: created.membershipNo, paidThroughMonth: created.paidThroughMonth },
        session,
        required: true,
      });

      return created;
    });

    return res.status(201).json({ success: true, message: "Member seat created", seat });
  } catch (error) {
    return sendSeatError(res, "createSeat", error, "Failed to create member seat");
  }
};

// ─── PUT /api/admin/seats/:id ────────────────────────────────────────────────
// Claimed or retired seats are immutable. The write itself is conditional on
// "still unclaimed", so a member claiming the seat mid-edit can never be
// overwritten. A current phone change belongs on Member.phone, not here.

export const updateSeat = async (req, res) => {
  try {
    const input = parseSeatInput(req.body ?? {});
    if (input.error) return res.status(400).json({ success: false, message: input.error });

    const seat = await runInTransactionWithRetry(async (session) => {
      const existing = await MemberSeat.findById(req.params.id).session(session);

      if (!existing) throw httpError(404, "Member seat not found");
      if (existing.isRetired) throw httpError(400, "Retired seats cannot be edited");
      if (existing.isClaimed) throw httpError(400, "Claimed seats are locked and cannot be edited");

      const conflict = await MemberSeat.findOne({
        membershipNo: input.membershipNo,
        _id: { $ne: existing._id },
      })
        .select("_id")
        .session(session);

      if (conflict) throw httpError(409, "Another seat already uses this membership number");

      const updated = await MemberSeat.findOneAndUpdate(
        { _id: existing._id, isClaimed: false, isRetired: false },
        {
          $set: {
            membershipNo: input.membershipNo,
            registeredPhone: input.phone,
            paidThroughMonth: input.paidThroughMonth,
          },
        },
        { new: true, session },
      );

      if (!updated) throw httpError(409, "This seat was just claimed and can no longer be edited");

      await writeAuditLog({
        action: "SEAT_UPDATED",
        performedBy: req.clerkUserId,
        targetId: updated._id,
        description: `Member seat ${existing.membershipNo} updated`,
        before: { membershipNo: existing.membershipNo, paidThroughMonth: existing.paidThroughMonth },
        after: { membershipNo: updated.membershipNo, paidThroughMonth: updated.paidThroughMonth },
        metadata: { registeredPhoneChanged: existing.registeredPhone !== updated.registeredPhone },
        session,
        required: true,
      });

      return updated;
    });

    return res.status(200).json({ success: true, message: "Member seat updated", seat });
  } catch (error) {
    return sendSeatError(res, "updateSeat", error, "Failed to update member seat");
  }
};

// ─── DELETE /api/admin/seats/:id ─────────────────────────────────────────────

export const deleteSeat = async (req, res) => {
  try {
    await runInTransactionWithRetry(async (session) => {
      const existing = await MemberSeat.findById(req.params.id).session(session);

      if (!existing) throw httpError(404, "Member seat not found");
      if (existing.isClaimed) throw httpError(400, "Claimed seats cannot be deleted");
      if (existing.isRetired) throw httpError(400, "Retired seats cannot be deleted");

      const result = await MemberSeat.deleteOne(
        { _id: existing._id, isClaimed: false, isRetired: false },
        { session },
      );

      if (result.deletedCount === 0) {
        throw httpError(409, "This seat was just claimed and can no longer be deleted");
      }

      await writeAuditLog({
        action: "SEAT_DELETED",
        performedBy: req.clerkUserId,
        targetId: existing._id,
        description: `Member seat ${existing.membershipNo} deleted`,
        before: { membershipNo: existing.membershipNo, paidThroughMonth: existing.paidThroughMonth },
        session,
        required: true,
      });
    });

    return res.status(200).json({ success: true, message: "Member seat deleted" });
  } catch (error) {
    return sendSeatError(res, "deleteSeat", error, "Failed to delete member seat");
  }
};

// ─── POST /api/admin/seats/import ────────────────────────────────────────────
// The whole import and its audit are one transaction. (performedBy used
// req.auth?.userId, which does not exist in current Clerk, so it was always
// "UNKNOWN_ADMIN".)

export const importSeatsFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "CSV file is required" });
    }

    const { headers, rows } = parseCSV(req.file.buffer.toString("utf8"));

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "CSV contains no data rows" });
    }
    if (rows.length > MAX_CSV_ROWS) {
      return res.status(400).json({
        success: false,
        message: `CSV cannot contain more than ${MAX_CSV_ROWS} rows`,
      });
    }

    const missingHeaders = validateCSVHeaders(headers);
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required CSV columns: ${missingHeaders.join(", ")}`,
      });
    }

    const result = await runInTransactionWithRetry(async (session) => {
      const importResult = await importMemberSeats({
        rows,
        performedBy: req.clerkUserId,
        session,
      });

      if (importResult.errors.length === 0) {
        await writeAuditLog({
          action: "SEAT_IMPORTED",
          performedBy: req.clerkUserId,
          description:
            `Member seat CSV import: ${importResult.created} created, ` +
            `${importResult.updated} updated, ${importResult.skippedClaimed + importResult.skippedRetired} skipped`,
          metadata: {
            totalRows: importResult.totalRows,
            created: importResult.created,
            updated: importResult.updated,
            skippedClaimed: importResult.skippedClaimed,
            skippedRetired: importResult.skippedRetired,
          },
          session,
          required: true,
        });
      }

      return importResult;
    });

    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "CSV validation failed. No changes were made.",
        results: result,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member seat import completed",
      results: result,
    });
  } catch (error) {
    return sendSeatError(res, "importSeatsFromCSV", error, "Failed to import member seats");
  }
};