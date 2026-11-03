const express = require('express');
const { getReferrals, updateReferral } = require('./referral.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', getReferrals);
router.patch('/:referralId', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR', 'DOCTOR'), updateReferral);

module.exports = router;
