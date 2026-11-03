const express = require('express');
const { getAuditLogs } = require('./audit.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', requireRoles('SUPER_ADMIN'), getAuditLogs);

module.exports = router;
