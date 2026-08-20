// server/controllers/memberSeatController.js
//
// Admin pre-registers membership numbers before a member can sign up.
// Only membershipNo (required) and paidThroughMonth (required) are
// admin/CSV-provided. name, plotNo, designation are supplied by the
// member themselves at /create-profile — not duplicated here. joinDate
// is set automatically at seat-claim time (memberController.js), never
// here.

import MemberSeat from "../models/MemberSeat.js";

// ── sanitize ──────────────────────────────────────────────────────────────────
const sanitize = (val) => {
  if (typeof val !== "string") return val;
  return val.trim().replace(/^[=+\-@\t\r]/, "");
};

// ── parseCSV ──────────────────────────────────────────────────────────────────
const parseCSV = (text) => {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(l => l.trim());

  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const fields = [];
    let current  = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
  const rows    = lines.slice(1).map((line, i) => {
    const values = parseRow(line);
    const row    = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });
    row._lineNumber = i + 2;
    return row;
  });

  return { headers, rows };
};

// ── validateRow ───────────────────────────────────────────────────────────────
// membershipNo and paidThroughMonth are the ONLY fields this accepts —
// both required.

const REQUIRED_HEADERS = ["membershipno", "paidthroughmonth"];
const PAID_THROUGH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const validateRow = (row) => {
  const errors = [];

  const membershipNo       = sanitize(row["membershipno"]      ?? "").toUpperCase();
  const paidThroughMonthRaw = sanitize(row["paidthroughmonth"] ?? "");

  if (!membershipNo) errors.push("membershipNo is required");
  if (!/^[A-Z0-9\-]+$/.test(membershipNo)) errors.push("membershipNo contains invalid characters");
  if (!paidThroughMonthRaw) errors.push("paidThroughMonth is required");

  let paidThroughMonth = null;
  if (paidThroughMonthRaw) {
    if (!PAID_THROUGH_PATTERN.test(paidThroughMonthRaw)) {
      errors.push(`paidThroughMonth "${paidThroughMonthRaw}" must be in YYYY-MM format (e.g. 2026-03)`);
    } else {
      const [yearStr, monthStr] = paidThroughMonthRaw.split("-");
      const asDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      const now    = new Date();
      const nowFirstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (asDate > nowFirstOfMonth) {
        errors.push("paidThroughMonth cannot be in the future");
      } else {
        paidThroughMonth = paidThroughMonthRaw;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? {
      membershipNo,
      paidThroughMonth,
    } : null,
  };
};

// ── getAllSeats ────────────────────────────────────────────────────────────────

export const getAllSeats = async (req, res) => {
  try {
    const seats = await MemberSeat.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, seats });
  } catch (error) {
    console.error("getAllSeats error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── createSeat ────────────────────────────────────────────────────────────────

export const createSeat = async (req, res) => {
  try {
    const { membershipNo, paidThroughMonth } = req.body;

    if (!membershipNo?.trim()) return res.status(400).json({ success: false, message: "Membership number is required" });
    if (!paidThroughMonth) return res.status(400).json({ success: false, message: "paidThroughMonth is required" });

    if (!PAID_THROUGH_PATTERN.test(paidThroughMonth)) {
      return res.status(400).json({ success: false, message: "paidThroughMonth must be in YYYY-MM format" });
    }

    const clean = membershipNo.trim().toUpperCase();
    const existing = await MemberSeat.findOne({ membershipNo: clean });
    if (existing) return res.status(400).json({ success: false, message: `Membership number ${clean} already exists` });

    const seat = await MemberSeat.create({
      membershipNo,
      paidThroughMonth,
    });

    return res.status(201).json({ success: true, seat });
  } catch (error) {
    console.error("createSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── updateSeat ────────────────────────────────────────────────────────────────

export const updateSeat = async (req, res) => {
  try {
    const seat = await MemberSeat.findById(req.params.id);
    if (!seat) return res.status(404).json({ success: false, message: "Seat not found" });

    const { membershipNo, paidThroughMonth } = req.body;

    if (paidThroughMonth && !PAID_THROUGH_PATTERN.test(paidThroughMonth)) {
      return res.status(400).json({ success: false, message: "paidThroughMonth must be in YYYY-MM format" });
    }

    if (seat.isClaimed) {
      // Claimed seats: paidThroughMonth is locked — it was already
      // consumed once at claim time and re-applying it retroactively
      // would create duplicate/incorrect backdated charges. membershipNo
      // is permanently locked once claimed too, matching the same rule
      // already enforced for Member.membershipNo elsewhere.
      return res.status(400).json({
        success: false,
        message: "This seat has been claimed — membershipNo and paidThroughMonth can no longer be edited.",
      });
    }

    if (membershipNo) {
      const clean = membershipNo.trim().toUpperCase();
      if (clean !== seat.membershipNo) {
        const conflict = await MemberSeat.findOne({ membershipNo: clean });
        if (conflict) return res.status(400).json({ success: false, message: `Membership number ${clean} already exists` });
        seat.membershipNo = clean;
      }
    }
    if (paidThroughMonth !== undefined) seat.paidThroughMonth = paidThroughMonth || null;

    await seat.save();
    return res.status(200).json({ success: true, seat });
  } catch (error) {
    console.error("updateSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── deleteSeat ────────────────────────────────────────────────────────────────

export const deleteSeat = async (req, res) => {
  try {
    const seat = await MemberSeat.findById(req.params.id);
    if (!seat) return res.status(404).json({ success: false, message: "Seat not found" });
    if (seat.isClaimed) return res.status(400).json({
      success: false,
      message: "This seat has been claimed by a registered member. Delete the member account first.",
    });
    await MemberSeat.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Seat deleted" });
  } catch (error) {
    console.error("deleteSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── importSeatsFromCSV ────────────────────────────────────────────────────────

export const importSeatsFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No CSV file uploaded" });
    }

    const text = req.file.buffer.toString("utf-8");

    if (text.includes("<html") || text.includes("<?xml")) {
      return res.status(400).json({ success: false, message: "File does not appear to be a CSV" });
    }

    const { headers, rows } = parseCSV(text);

    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `CSV is missing required columns: ${missingHeaders.join(", ")}`,
        hint:    "Required columns: membershipNo, paidThroughMonth",
      });
    }

    if (rows.length === 0) return res.status(400).json({ success: false, message: "CSV file has no data rows" });
    if (rows.length > 1000) return res.status(400).json({ success: false, message: "CSV cannot exceed 1000 rows per import" });

    const results = { created: 0, updated: 0, errors: [] };

    for (const row of rows) {
      const { valid, errors, parsed } = validateRow(row);

      if (!valid) {
        results.errors.push({
          line:         row._lineNumber,
          membershipNo: row["membershipno"] || "(empty)",
          errors,
        });
        continue;
      }

      try {
        const existing = await MemberSeat.findOne({ membershipNo: parsed.membershipNo });

        if (existing) {
          if (existing.isClaimed) {
            results.errors.push({
              line:         row._lineNumber,
              membershipNo: parsed.membershipNo,
              errors:       ["Seat already claimed — cannot update via CSV"],
            });
            continue;
          }
          existing.paidThroughMonth = parsed.paidThroughMonth;
          await existing.save();
          results.updated++;
        } else {
          await MemberSeat.create({
            membershipNo:     parsed.membershipNo,
            paidThroughMonth: parsed.paidThroughMonth,
          });
          results.created++;
        }
      } catch (rowError) {
        results.errors.push({
          line:         row._lineNumber,
          membershipNo: parsed.membershipNo,
          errors:       [rowError.message],
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      results,
    });
  } catch (error) {
    console.error("importSeatsFromCSV error:", error.message);
    return res.status(500).json({ success: false, message: "Server error during import" });
  }
};