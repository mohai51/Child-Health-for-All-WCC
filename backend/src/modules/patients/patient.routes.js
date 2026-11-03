const express = require('express');
const { z } = require('zod');
const {
  searchPatients,
  createPatient,
  createCampVisitForPatient,
  getPatientById,
  getCampRegistrations
} = require('./patient.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles, requireCampAccess } = require('../../middleware/rbac.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router();

const createPatientSchema = z.object({
  body: z.object({
    campId: z.string().min(1, 'ক্যাম্প নির্বাচন আবশ্যক (Camp ID required)'),
    fullName: z.string().min(2, 'রোগীর পূর্ণ নাম দিন (Patient name required)'),
    ageYears: z.number().min(0).max(18, 'বয়স ০ থেকে ১৮ বছরের মধ্যে হতে হবে (Age must be 0-18)'),
    ageMonths: z.number().min(0).max(11).optional(),
    sex: z.enum(['MALE', 'FEMALE', 'OTHER']),
    guardianName: z.string().min(2, 'অভিভাবকের নাম দিন (Guardian name required)'),
    guardianPhone: z.string().optional(),
    district: z.string().min(2, 'জেলা দিন (District required)'),
    upazila: z.string().min(2, 'উপজেলা দিন (Upazila required)'),
    isPourashava: z.boolean().optional(),
    pourashavaName: z.string().optional(),
    wardNo: z.string().optional(),
    weight: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
    mainComplaint: z.string().optional(),
    relevantHealthNotes: z.string().optional(),
    guardianConsent: z.boolean().refine(val => val === true, {
      message: 'অভিভাবকের সম্মতি টিক দিন (Consent required)'
    })
  })
});

router.use(authenticate);

// Search patients
router.get('/search', searchPatients);

// Register new patient (Super Admin, Registration Volunteer, Camp Coordinator)
router.post(
  '/',
  requireRoles('SUPER_ADMIN', 'REGISTRATION_VOLUNTEER', 'CAMP_COORDINATOR'),
  validate(createPatientSchema),
  createPatient
);

// Get single patient profile
router.get('/:patientId', getPatientById);

module.exports = router;
