const AuditLog = require('../../utils/auditLog.model');

async function getAuditLogs(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.resourceType) query.resourceType = req.query.resourceType;
    if (req.query.result) query.result = req.query.result;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'অডিট লগ আনতে সমস্যা হয়েছে (Failed to fetch audit logs)',
      error: error.message
    });
  }
}

module.exports = {
  getAuditLogs
};
