// server/services/auditService.js

import AuditLog from "../models/AuditLog.js";

/**
 * Writes an audit record.
 *
 * Normal/best-effort audit:
 *   required: false
 *
 * Critical transactional audit:
 *   required: true
 *   session: MongoDB transaction session
 *
 * When required=true, an audit failure is propagated so the
 * surrounding transaction can roll back.
 */
export const writeAuditLog = async ({
  action,
  performedBy,
  targetId,
  description,
  before,
  after,
  metadata,
  session = null,
  required = false,
}) => {
  try {
    const auditData = {
      action,
      performedBy,
      targetId: targetId || undefined,
      description,
      before: before || undefined,
      after: after || undefined,
      metadata: metadata || undefined,
    };

    if (session) {
      const [log] = await AuditLog.create(
        [auditData],
        { session },
      );

      return log;
    }

    return await AuditLog.create(auditData);
  } catch (error) {
    console.error(
      "[AuditLog] Write failed:",
      error.message,
      {
        action,
        performedBy,
      },
    );

    if (required) {
      throw error;
    }

    return null;
  }
};

/**
 * Returns paginated audit log records.
 */
export const getAuditLogs = async ({
  action,
  performedBy,
  targetId,
  page = 1,
  limit = 50,
} = {}) => {
  const filter = {};

  if (action) {
    filter.action = action;
  }

  if (performedBy) {
    filter.performedBy = performedBy;
  }

  if (targetId) {
    filter.targetId = targetId;
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(
    100,
    Math.max(1, Number(limit) || 50),
  );

  const skip = (safePage - 1) * safeLimit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
};