// server/controllers/auditController.js
// Read-only — admin views the audit log.
//
// CHANGE (this pass): query values must be plain strings (blocks operator
// objects like ?action[$ne]=x) and targetId must be a valid ObjectId (was a
// 500 CastError).

import mongoose from "mongoose";
import { getAuditLogs } from "../services/auditService.js";

const asString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const getAuditLogHandler = async (req, res) => {
  try {
    const action = asString(req.query.action);
    const performedBy = asString(req.query.performedBy);
    const targetId = asString(req.query.targetId);

    if (targetId && !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, message: "Invalid targetId" });
    }

    const result = await getAuditLogs({
      action,
      performedBy,
      targetId,
      page: Number.parseInt(req.query.page, 10),
      limit: Number.parseInt(req.query.limit, 10),
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("getAuditLog error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};