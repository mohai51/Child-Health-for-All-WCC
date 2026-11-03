const express = require('express');
const { z } = require('zod');
const {
  verifyAndFindPatient,
  createConsultation,
  saveConsultation,
  getConsultationById,
  getCampConsultations
} = require('./consultation.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// Find patient in camp by Patient ID (Doctor only)
router.get('/search-patient', requireRoles('DOCTOR', 'SUPER_ADMIN'), verifyAndFindPatient);

// Start consultation (Doctor only)
router.post(
  '/',
  requireRoles('DOCTOR', 'SUPER_ADMIN'),
  validate(
    z.object({
      body: z.object({
        patientId: z.string().min(1, 'Patient ID required'),
        visitId: z.string().min(1, 'Visit ID required')
      })
    })
  ),
  createConsultation
);

// Save / complete consultation (Doctor only)
router.patch(
  '/:consultationId',
  requireRoles('DOCTOR', 'SUPER_ADMIN'),
  saveConsultation
);

// Get single consultation
router.get('/:consultationId', getConsultationById);

// List consultations for a camp
router.get('/', getCampConsultations);

module.exports = router;
