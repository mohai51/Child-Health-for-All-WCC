const express = require('express');
const { getSummaryReport, getDoctorsReport, exportCampReport } = require('./report.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// Reports accessible to Super Admin and Camp Coordinators (and Doctors for viewing)
router.get('/summary', getSummaryReport);
router.get('/doctors', getDoctorsReport);
router.get('/export', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), exportCampReport);

module.exports = router;
