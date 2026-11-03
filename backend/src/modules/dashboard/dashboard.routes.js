const express = require('express');
const { getMainDashboardStats } = require('./dashboard.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/stats', getMainDashboardStats);

module.exports = router;
