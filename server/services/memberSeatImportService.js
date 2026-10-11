// server/services/memberSeatImportService.js
//
// Business logic for importing MemberSeat records from CSV.
//
// Responsibilities:
//   - Normalize CSV values.
//   - Validate every row.
//   - Detect duplicate membership numbers inside the CSV.
//   - Normalize phone numbers.
//   - Protect claimed seats.
//   - Protect retired seats.
//   - Perform one database lookup instead of one query per row.
//   - Bulk create/update unclaimed seats.
//
// The controller should NOT contain this business logic.
//
// Important rules:
//
//   UNCLAIMED + NOT RETIRED
//       → may be created or synchronized from CSV
//
//   CLAIMED
//       → never overwritten
//
//   RETIRED
//       → never resurrected
//
// MemberSeat is an eligibility/provisioning record,
// not the member profile itself.

import MemberSeat from "../models/MemberSeat.js";
import {
  normalizePhone,
  isValidPhone,
} from "../utils/phoneUtils.js";
import { getDhakaDateParts } from "../utils/dateTime.js";

const PAID_THROUGH_MONTH_REGEX =
  /^\d{4}-(0[1-9]|1[0-2])$/;

const MEMBERSHIP_NO_REGEX = /^\d+$/;

// ─── Helpers ────────────────────────────────────────────────────────────────

const normalizeMembershipNo = (value) => {
  return String(value ?? "").trim();
};

const normalizePaidThroughMonth = (value) => {
  return String(value ?? "").trim();
};

const normalizeHeader = (value) => {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
};

const getCurrentMonth = () => {
  const { year, month } = getDhakaDateParts();

  return `${year}-${String(month).padStart(2, "0")}`;
};

const isFuturePaidThroughMonth = (value) => {
  return value > getCurrentMonth();
};

const normalizeRowKeys = (row) => {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }

  return normalized;
};

const validateRow = (row, line) => {
  const errors = [];

  const membershipNo = normalizeMembershipNo(
    row.membershipno,
  );

  const rawPhone = String(row.phone ?? "").trim();

  const paidThroughMonth =
    normalizePaidThroughMonth(row.paidthroughmonth);

  if (!membershipNo) {
    errors.push("Membership number is required");
  } else if (!MEMBERSHIP_NO_REGEX.test(membershipNo)) {
    errors.push(
      "Membership number must contain digits only",
    );
  }

  if (!rawPhone) {
    errors.push("Phone number is required");
  }

  let phone = null;

  if (rawPhone) {
    try {
      phone = normalizePhone(rawPhone);
    } catch {
      phone = null;
    }

    if (!phone || !isValidPhone(phone)) {
      errors.push("Invalid phone number");
    }
  }

  if (!paidThroughMonth) {
    errors.push("paidThroughMonth is required");
  } else if (
    !PAID_THROUGH_MONTH_REGEX.test(paidThroughMonth)
  ) {
    errors.push(
      "paidThroughMonth must be in YYYY-MM format",
    );
  } else if (isFuturePaidThroughMonth(paidThroughMonth)) {
    errors.push(
      "paidThroughMonth cannot be in the future",
    );
  }

  return {
    line,
    membershipNo,
    phone,
    paidThroughMonth,
    errors,
  };
};

// ─── importMemberSeats ─────────────────────────────────────────────────────

export const importMemberSeats = async ({
  rows,
  performedBy = "SYSTEM",
  session = null,
}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalRows: 0,
      created: 0,
      updated: 0,
      skippedClaimed: 0,
      skippedRetired: 0,
      errors: [],
      warnings: [],
      performedBy,
    };
  }

  // ── Step 1: Normalize + validate ALL rows first ─────────────────────────

  const normalizedRows = [];
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const line = index + 2; // row 1 is the header

    const normalizedInput = normalizeRowKeys(rows[index]);

    const result = validateRow(
      normalizedInput,
      line,
    );

    if (result.errors.length > 0) {
      errors.push(result);
      continue;
    }

    normalizedRows.push({
      line,
      membershipNo: result.membershipNo,
      phone: result.phone,
      paidThroughMonth: result.paidThroughMonth,
    });
  }

  // Do not partially import a malformed CSV.
  //
  // This is safer for administrative financial data:
  //
  // bad CSV
  //    ↓
  // report every problem
  //    ↓
  // admin fixes CSV
  //    ↓
  // import again
  //
  // instead of silently importing only half the file.
  if (errors.length > 0) {
    return {
      totalRows: rows.length,
      created: 0,
      updated: 0,
      skippedClaimed: 0,
      skippedRetired: 0,
      errors,
      warnings: [],
      performedBy,
    };
  }

  // ── Step 2: Detect duplicate membership numbers inside CSV ──────────────

  const seenMembershipNos = new Set();
  const duplicateErrors = [];

  for (const row of normalizedRows) {
    if (seenMembershipNos.has(row.membershipNo)) {
      duplicateErrors.push({
        line: row.line,
        membershipNo: row.membershipNo,
        errors: [
          "Duplicate membership number in CSV",
        ],
      });
    }

    seenMembershipNos.add(row.membershipNo);
  }

  if (duplicateErrors.length > 0) {
    return {
      totalRows: rows.length,
      created: 0,
      updated: 0,
      skippedClaimed: 0,
      skippedRetired: 0,
      errors: duplicateErrors,
      warnings: [],
      performedBy,
    };
  }

  // ── Step 3: ONE database lookup ─────────────────────────────────────────

  const membershipNumbers = normalizedRows.map(
    (row) => row.membershipNo,
  );

   const existingSeats = await MemberSeat.find({
    membershipNo: { $in: membershipNumbers },
  })
    .session(session)
    .lean();

  const existingMap = new Map(
    existingSeats.map((seat) => [
      seat.membershipNo,
      seat,
    ]),
  );

  // ── Step 4: Build database operations ───────────────────────────────────

  const operations = [];

  let created = 0;
  let updated = 0;
  let skippedClaimed = 0;
  let skippedRetired = 0;

  const warnings = [];

  for (const row of normalizedRows) {
    const existing = existingMap.get(
      row.membershipNo,
    );

    // Claimed seats are historical identity records.
    if (existing?.isClaimed) {
      skippedClaimed += 1;

      warnings.push({
        line: row.line,
        membershipNo: row.membershipNo,
        message:
          "Claimed seat was skipped and not modified",
      });

      continue;
    }

    // Retired seats can NEVER be resurrected.
    if (existing?.isRetired) {
      skippedRetired += 1;

      warnings.push({
        line: row.line,
        membershipNo: row.membershipNo,
        message:
          "Retired seat was skipped and not modified",
      });

      continue;
    }

    if (!existing) {
      operations.push({
        insertOne: {
          document: {
            membershipNo: row.membershipNo,
            registeredPhone: row.phone,
            paidThroughMonth:
              row.paidThroughMonth,
            isClaimed: false,
            claimedByClerkId: null,
            claimedAt: null,
            joinDate: null,
            isRetired: false,
            retiredAt: null,
          },
        },
      });

      created += 1;
      continue;
    }

    // Existing but still unclaimed:
    // synchronize the pre-registration information.
    operations.push({
      updateOne: {
        filter: {
          _id: existing._id,
          isClaimed: false,
          isRetired: false,
        },
        update: {
          $set: {
            registeredPhone: row.phone,
            paidThroughMonth:
              row.paidThroughMonth,
          },
        },
      },
    });

    updated += 1;
  }

  // ── Step 5: One bulk database write ─────────────────────────────────────
  if (operations.length > 0) {
    await MemberSeat.bulkWrite(operations, {
      ordered: false,
      ...(session ? { session } : {}),
    });
  }

  return {
    totalRows: rows.length,
    created,
    updated,
    skippedClaimed,
    skippedRetired,
    errors: [],
    warnings,
    performedBy,
  };
};