// server/controllers/chargeController.js
//
// HTTP layer for extra charge management.
// Input validation lives here. Business logic lives in extraChargeService.js.

import {
  createExtraCharges,
  cancelExtraCharge,
  getAllExtraCharges,
  getUnpaidExtraChargesForMember,
} from "../services/extraChargeService.js";
import Member      from "../models/Member.js";
import ExtraCharge from "../models/ExtraCharge.js";

// ─── POST /api/charges ────────────────────────────────────────────────────────
// Admin creates extra charge(s) for one, multiple, or all members.
//
// Request body:
//   label       (String, required)          — short charge name
//   purpose     (String, required)          — detailed reason
//   amount      (Number, required, min: 1)  — amount in BDT
//   dueDate     (String, optional)          — ISO date string
//   targetType  (String, required)          — "single" | "multiple" | "all"
//   memberIds   (Array, conditional)        — required for "single"/"multiple"

export const createCharge = async (req, res) => {
  try {
    const { label, purpose, amount, dueDate, targetType, memberIds } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!label?.trim()) {
      return res.status(400).json({ success: false, message: "label is required" });
    }

    if (!purpose?.trim()) {
      return res.status(400).json({
        success: false,
        message:  "purpose is required — members must know why they are being charged",
      });
    }

    if (!amount || isNaN(amount) || Number(amount) < 1) {
      return res.status(400).json({
        success: false,
        message:  "amount must be a positive number",
      });
    }

    if (!["single", "multiple", "all"].includes(targetType)) {
      return res.status(400).json({
        success: false,
        message:  "targetType must be 'single', 'multiple', or 'all'",
      });
    }

    if ((targetType === "single" || targetType === "multiple") && (!memberIds || memberIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message:  "memberIds is required when targetType is 'single' or 'multiple'",
      });
    }

    if (targetType === "single" && memberIds.length !== 1) {
      return res.status(400).json({
        success: false,
        message:  "targetType 'single' requires exactly one memberId",
      });
    }

    if (dueDate && isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({
        success: false,
        message:  "dueDate must be a valid date string",
      });
    }

    // ── Business logic ──────────────────────────────────────────────────────
    const result = await createExtraCharges({
      label,
      purpose,
      amount:     Number(amount),
      dueDate:    dueDate || null,
      targetType,
      memberIds:  memberIds || [],
      createdBy:  req.clerkUserId,
    });

    return res.status(201).json({
      success: true,
      message: `Charge created for ${result.created} member(s)`,
      batchId: result.batchId,
      created: result.created,
    });
  } catch (error) {
    // Known business errors from the service
    const knownErrors = [
      "memberIds is required",
      "member IDs were not found",
      "No members found",
      "targetType must be",
    ];
    const isKnownError = knownErrors.some(msg => error.message.includes(msg));

    if (isKnownError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error("createCharge error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/charges ─────────────────────────────────────────────────────────
// Admin: all extra charges with optional filters.
// Query params: status, batchId, page, limit

export const getAllCharges = async (req, res) => {
  try {
    const {
      status,
      batchId,
      page  = "1",
      limit = "50",
    } = req.query;

    // Validate status filter if provided
    if (status && !["Unpaid", "Paid", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:  "status filter must be 'Unpaid', 'Paid', or 'Cancelled'",
      });
    }

    const result = await getAllExtraCharges({
      status:  status || undefined,
      batchId: batchId || undefined,
      page:    parseInt(page, 10),
      limit:   Math.min(parseInt(limit, 10), 100), // cap at 100 per page
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("getAllCharges error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/charges/me ──────────────────────────────────────────────────────
// Member: their own unpaid extra charges.
// Used by the PaymentSection to show outstanding charges.

export const getMemberCharges = async (req, res) => {
  try {
    const member = await Member.findOne({ clerkUserId: req.clerkUserId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const charges = await getUnpaidExtraChargesForMember(member._id);

    return res.status(200).json({ success: true, charges });
  } catch (error) {
    console.error("getMemberCharges error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE /api/charges/:id ──────────────────────────────────────────────────
// Admin: cancel a specific extra charge.
// Sets status to "Cancelled" — does NOT delete the record.
//
// Request body:
//   cancelReason (String, optional) — explanation for the cancellation

export const cancelCharge = async (req, res) => {
  try {
    const { cancelReason } = req.body;

    const charge = await cancelExtraCharge({
      chargeId:    req.params.id,
      cancelReason: cancelReason || "",
      cancelledBy:  req.clerkUserId,
    });

    return res.status(200).json({
      success: true,
      message: `Charge "${charge.label}" has been cancelled`,
      charge,
    });
  } catch (error) {
    const knownErrors = ["not found", "already been paid", "already been cancelled"];
    const isKnownError = knownErrors.some(msg => error.message.includes(msg));

    if (isKnownError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error("cancelCharge error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/charges/:id ─────────────────────────────────────────────────────
// Admin: single charge details including batch information.

export const getChargeById = async (req, res) => {
  try {
    const charge = await ExtraCharge
      .findById(req.params.id)
      .populate("member", "name email membershipNo plotNo")
      .lean();

    if (!charge) {
      return res.status(404).json({ success: false, message: "Charge not found" });
    }

    // If this charge is part of a batch, also return batch summary
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
    console.error("getChargeById error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};