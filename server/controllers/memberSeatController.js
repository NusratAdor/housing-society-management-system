// server/controllers/memberSeatController.js
//
// joinDate is now OPTIONAL in both manual form and CSV import.
// Opening balance covers all historical dues as a single charge.
// joinDate only drives the "Member since" display — if unavailable,
// the dashboard falls back to Member.createdAt (digital signup date).

import MemberSeat    from "../models/MemberSeat.js";
import MonthlyCharge from "../models/MonthlyCharge.js";

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
// joinDate is OPTIONAL — only membershipNo, name, dueAmount are required.

const REQUIRED_HEADERS = ["membershipno", "name", "plotno", "dueamount"];

const validateRow = (row) => {
  const errors = [];

  const membershipNo = sanitize(row["membershipno"] ?? "").toUpperCase();
  const name         = sanitize(row["name"]         ?? "");
  const dueAmountRaw = sanitize(row["dueamount"]    ?? "0");
  const joinDateRaw  = sanitize(row["joindate"]     ?? ""); // optional

  if (!membershipNo) errors.push("membershipNo is required");
  if (!/^[A-Z0-9\-]+$/.test(membershipNo)) errors.push("membershipNo contains invalid characters");
  if (!name) errors.push("name is required");

  const dueAmount = parseFloat(dueAmountRaw);
  if (isNaN(dueAmount)) errors.push(`dueAmount "${dueAmountRaw}" is not a number`);
  if (dueAmount < 0)    errors.push("dueAmount cannot be negative");

  // joinDate validation — only if provided
  let parsedDate = null;
  if (joinDateRaw) {
    parsedDate = new Date(joinDateRaw);
    if (isNaN(parsedDate.getTime())) {
      errors.push(`joinDate "${joinDateRaw}" is not a valid date (use YYYY-MM-DD)`);
      parsedDate = null;
    } else if (parsedDate > new Date()) {
      errors.push("joinDate cannot be in the future");
      parsedDate = null;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? {
      membershipNo,
      name,
      plotNo:      sanitize(row["plotno"]      ?? ""),
      designation: sanitize(row["designation"] ?? ""),
      joinDate:    parsedDate, // null if not provided — that's fine
      dueAmount:   Math.round(isNaN(dueAmount) ? 0 : dueAmount),
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
    const { membershipNo, name, plotNo, designation, joinDate } = req.body;

    if (!membershipNo?.trim()) return res.status(400).json({ success: false, message: "Membership number is required" });
    if (!name?.trim())         return res.status(400).json({ success: false, message: "Name is required" });

    const clean = membershipNo.trim().toUpperCase();
    const existing = await MemberSeat.findOne({ membershipNo: clean });
    if (existing) return res.status(400).json({ success: false, message: `Membership number ${clean} already exists` });

    const seat = await MemberSeat.create({
      membershipNo: clean,
      name:         name.trim(),
      plotNo:       plotNo?.trim() || "",
      designation:  designation?.trim() || "",
      joinDate:     joinDate ? new Date(joinDate) : null, // optional
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

    const { membershipNo, name, plotNo, designation, joinDate } = req.body;

    if (seat.isClaimed) {
      if (name)        seat.name        = name.trim();
      if (plotNo !== undefined) seat.plotNo = plotNo.trim();
      if (designation !== undefined) seat.designation = designation.trim();
      // joinDate and membershipNo locked on claimed seats
    } else {
      if (membershipNo) {
        const clean = membershipNo.trim().toUpperCase();
        if (clean !== seat.membershipNo) {
          const conflict = await MemberSeat.findOne({ membershipNo: clean });
          if (conflict) return res.status(400).json({ success: false, message: `Membership number ${clean} already exists` });
          seat.membershipNo = clean;
        }
      }
      if (name)               seat.name        = name.trim();
      if (plotNo !== undefined)      seat.plotNo      = plotNo.trim();
      if (designation !== undefined) seat.designation = designation.trim();
      if (joinDate)           seat.joinDate    = new Date(joinDate);
    }

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
        hint:    "Required: membershipNo, name, dueAmount — Optional: plotNo, designation, joinDate",
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
          // Always update display fields
          existing.name        = parsed.name;
          existing.plotNo      = parsed.plotNo;
          existing.designation = parsed.designation;

          // Only update joinDate and openingBalance on unclaimed seats
          if (!existing.isClaimed) {
            if (parsed.joinDate) existing.joinDate = parsed.joinDate;
            existing.openingBalance = parsed.dueAmount;
          }

          await existing.save();
          results.updated++;
        } else {
          await MemberSeat.create({
            membershipNo:   parsed.membershipNo,
            name:           parsed.name,
            plotNo:         parsed.plotNo,
            designation:    parsed.designation,
            joinDate:       parsed.joinDate || null,
            openingBalance: parsed.dueAmount,
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