// server/controllers/auditController.js
// Read-only — admin views the audit log.

import { getAuditLogs } from "../services/auditService.js";

export const getAuditLogHandler = async (req, res) => {
  try {
    const {
      action,
      performedBy,
      targetId,
      page  = "1",
      limit = "50",
    } = req.query;

    const result = await getAuditLogs({
      action:      action      || undefined,
      performedBy: performedBy || undefined,
      targetId:    targetId    || undefined,
      page:        parseInt(page,  10),
      limit:       Math.min(parseInt(limit, 10), 100),
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("getAuditLog error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};