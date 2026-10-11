// server/controllers/chargeController.js
//
// HTTP layer for extra charge management.
// Input validation lives here. Business logic lives in extraChargeService.js.
//
// CHANGE (this pass): stricter validation (types, lengths, memberIds, ids),
// safe query parsing, and errors carry their own status code. Keep the label
// and purpose limits at or below ExtraCharge.js's maxlength.

import {
  createExtraCharges,
  cancelExtraCharge,
  getAllExtraCharges,
  getUnpaidExtraChargesForMember,
} from "../services/extraChargeService.js";
import Member      from "../models/Member.js";
import ExtraCharge from "../models/ExtraCharge.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_LABEL = 100;
const MAX_PURPOSE = 500;
const MAX_AMOUNT = 1_000_000; // typo guard, not a business rule

const asString = (value) => (typeof value === "string" ? value : undefined);

// Business errors carry statusCode; anything else is a real server error.
const sendError = (res, label, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ success: false, message: "Server error" });
};

// ─── POST /api/charges ────────────────────────────────────────────────────────

export const createCharge = async (req, res) => {
  try {
    const { label, purpose, amount, dueDate, targetType, memberIds } = req.body;

    if (typeof label !== "string" || !label.trim() || label.trim().length > MAX_LABEL) {
      return res.status(400).json({
        success: false,
        message: `label is required (max ${MAX_LABEL} characters)`,
      });
    }

    if (typeof purpose !== "string" || !purpose.trim() || purpose.trim().length > MAX_PURPOSE) {
      return res.status(400).json({
        success: false,
        message: `purpose is required — members must know why they are being charged (max ${MAX_PURPOSE} characters)`,
      });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

    if (!["single", "multiple", "all"].includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: "targetType must be 'single', 'multiple', or 'all'",
      });
    }

    if (targetType !== "all") {
      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "memberIds is required when targetType is 'single' or 'multiple'",
        });
      }
      if (!memberIds.every((id) => OBJECT_ID.test(String(id)))) {
        return res.status(400).json({
          success: false,
          message: "memberIds contains an invalid member ID",
        });
      }
      if (targetType === "single" && memberIds.length !== 1) {
        return res.status(400).json({
          success: false,
          message: "targetType 'single' requires exactly one memberId",
        });
      }
    }

    if (dueDate && Number.isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "dueDate must be a valid date string",
      });
    }

    const result = await createExtraCharges({
      label,
      purpose,
      amount: numericAmount,
      dueDate: dueDate || null,
      targetType,
      memberIds: targetType === "all" ? [] : memberIds,
      createdBy: req.clerkUserId,
    });

    return res.status(201).json({
      success: true,
      message: `Charge created for ${result.created} member(s)`,
      batchId: result.batchId,
      created: result.created,
    });
  } catch (error) {
    return sendError(res, "createCharge", error);
  }
};

// ─── GET /api/charges ─────────────────────────────────────────────────────────
// Query params: status, batchId, page, limit

export const getAllCharges = async (req, res) => {
  try {
    const status = asString(req.query.status);
    const batchId = asString(req.query.batchId);

    if (status && !["Unpaid", "Paid", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status filter must be 'Unpaid', 'Paid', or 'Cancelled'",
      });
    }

    const result = await getAllExtraCharges({
      status,
      batchId: batchId || undefined,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, "getAllCharges", error);
  }
};

// ─── GET /api/charges/me ──────────────────────────────────────────────────────

export const getMemberCharges = async (req, res) => {
  try {
    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const charges = await getUnpaidExtraChargesForMember(member._id);

    return res.status(200).json({ success: true, charges });
  } catch (error) {
    return sendError(res, "getMemberCharges", error);
  }
};

// ─── DELETE /api/charges/:id ──────────────────────────────────────────────────
// Cancels (status "Cancelled"); never deletes the record.

export const cancelCharge = async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid charge ID" });
    }

    const charge = await cancelExtraCharge({
      chargeId: req.params.id,
      cancelReason: asString(req.body?.cancelReason) ?? "",
      cancelledBy: req.clerkUserId,
    });

    return res.status(200).json({
      success: true,
      message: `Charge "${charge.label}" has been cancelled`,
      charge,
    });
  } catch (error) {
    return sendError(res, "cancelCharge", error);
  }
};

// ─── GET /api/charges/:id ─────────────────────────────────────────────────────

export const getChargeById = async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid charge ID" });
    }

    const charge = await ExtraCharge
      .findById(req.params.id)
      .populate("member", "name email membershipNo plots")
      .lean();

    if (!charge) {
      return res.status(404).json({ success: false, message: "Charge not found" });
    }

    let batchSummary = null;
    if (charge.batchId) {
      const [total, unpaid, paid, cancelled] = await Promise.all([
        ExtraCharge.countDocuments({ batchId: charge.batchId }),
        ExtraCharge.countDocuments({ batchId: charge.batchId, status: "Unpaid" }),
        ExtraCharge.countDocuments({ batchId: charge.batchId, status: "Paid" }),
        ExtraCharge.countDocuments({ batchId: charge.batchId, status: "Cancelled" }),
      ]);
      batchSummary = { total, unpaid, paid, cancelled };
    }

    return res.status(200).json({ success: true, charge, batchSummary });
  } catch (error) {
    return sendError(res, "getChargeById", error);
  }
};