const express = require('express');
const { getSummaryReport, getDoctorsReport, exportCampReport } = require('./report.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// Reports accessible to Super Admin, Camp Coordinators, and Doctors
router.get('/summary', getSummaryReport);
router.get('/doctors', getDoctorsReport);
router.get('/export', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR', 'DOCTOR'), exportCampReport);

module.exports = router;
