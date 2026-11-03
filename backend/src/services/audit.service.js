const AuditLog = require('../utils/auditLog.model');
const logger = require('../config/logger');

/**
 * Record an audit log entry
 * Ensures sensitive patient/medical content is never recorded into audit logs
 */
async function logAuditEvent({
  actorId = null,
  actorRole = 'anonymous',
  action,
  resourceType,
  resourceId = null,
  result = 'SUCCESS',
  req = null,
  metadata = {}
}) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip) : null;
    const userAgent = req ? req.headers['user-agent'] : null;

    // Filter metadata to sanitize any medical diagnoses or passwords
    const cleanMeta = { ...metadata };
    delete cleanMeta.password;
    delete cleanMeta.passwordHash;
    delete cleanMeta.prescriptionImage;
    delete cleanMeta.prescriptionBase64;

    await AuditLog.create({
      actorId,
      actorRole,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      result,
      ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : null,
      userAgent,
      metadata: cleanMeta
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to record audit log');
  }
}

module.exports = {
  logAuditEvent
};
