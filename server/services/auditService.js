// server/services/auditService.js
//
// Thin wrapper around AuditLog.create() that provides:
//   1. A consistent, typed interface for all log writes
//   2. Non-throwing behaviour — audit failures must never block operations
//   3. A single import point so controllers don't import AuditLog directly
//
// Design decision — why audit writes are fire-and-forget:
//   If the audit write fails (DB momentarily unavailable), the underlying
//   operation (fee change, member delete) has already committed. Throwing
//   from the audit write would make it look like the operation failed when
//   it actually succeeded. It is better to log the audit failure and let
//   the operation succeed, than to leave the system in an inconsistent
//   "did it work?" state.
//
//   In practice, Atlas M0 has >99.9% uptime and audit writes almost never
//   fail. The non-throwing wrapper is a defensive measure.

import AuditLog from "../models/AuditLog.js";

/**
 * writeAuditLog
 * Writes one AuditLog record. Never throws.
 *
 * @param {Object}   params
 * @param {string}   params.action       — from AuditLog action enum
 * @param {string}   params.performedBy  — Clerk userId or "SYSTEM"
 * @param {ObjectId} [params.targetId]   — primary entity affected
 * @param {string}   params.description  — human-readable summary
 * @param {*}        [params.before]     — state before the change
 * @param {*}        [params.after]      — state after the change
 * @param {*}        [params.metadata]   — any extra context
 */
export const writeAuditLog = async ({
  action,
  performedBy,
  targetId,
  description,
  before,
  after,
  metadata,
}) => {
  try {
    await AuditLog.create({
      action,
      performedBy,
      targetId:    targetId   || undefined,
      description,
      before:      before     || undefined,
      after:       after      || undefined,
      metadata:    metadata   || undefined,
    });
  } catch (err) {
    // Log the failure but never propagate it
    console.error("[AuditLog] Write failed:", err.message, { action, performedBy });
  }
};

/**
 * getAuditLogs
 * Returns paginated audit log records for the admin audit view.
 * Most recent first.
 *
 * @param {Object} options
 * @param {string} [options.action]      — filter by action type
 * @param {string} [options.performedBy] — filter by admin
 * @param {string} [options.targetId]    — filter by affected entity
 * @param {number} [options.page]
 * @param {number} [options.limit]
 */
export const getAuditLogs = async ({
  action,
  performedBy,
  targetId,
  page  = 1,
  limit = 50,
} = {}) => {
  const filter = {};
  if (action)      filter.action      = action;
  if (performedBy) filter.performedBy = performedBy;
  if (targetId)    filter.targetId    = targetId;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};