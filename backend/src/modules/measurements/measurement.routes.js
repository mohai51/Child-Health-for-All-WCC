const express = require('express');
const {
  searchPatient,
  saveMeasurement,
  calculateBmiEndpoint
} = require('./measurement.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// Search patient by ID, barcode, or phone
router.get(
  '/search-patient',
  requireRoles('MEASUREMENT_OFFICER', 'SUPER_ADMIN', 'DOCTOR', 'REGISTRATION_VOLUNTEER', 'CAMP_COORDINATOR'),
  searchPatient
);

// Save or update measurements (Height, Weight, Blood Group, Hemoglobin %, BMI)
router.post(
  '/save',
  requireRoles('MEASUREMENT_OFFICER', 'SUPER_ADMIN', 'DOCTOR', 'REGISTRATION_VOLUNTEER', 'CAMP_COORDINATOR'),
  saveMeasurement
);

// Live BMI calculation preview helper
router.get(
  '/calculate-bmi',
  calculateBmiEndpoint
);

module.exports = router;

