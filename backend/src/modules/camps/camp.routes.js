const express = require('express');
const { z } = require('zod');
const {
  getCamps,
  createCamp,
  getCampById,
  updateCamp,
  activateCamp,
  closeCamp,
  toggleCamp,
  getCampMembers,
  assignCampMember,
  removeCampMember
} = require('./camp.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router();

const createCampSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'ক্যাম্পের নাম দিন (Camp name required)'),
    date: z.string().min(4, 'তারিখ দিন (Camp date required)'),
    district: z.string().min(2, 'জেলা নির্বাচন করুন (District required)'),
    upazila: z.string().optional(),
    venue: z.string().min(2, 'স্থান/ভেন্যু দিন (Venue required)'),
    isPourashava: z.boolean().optional(),
    pourashavaName: z.string().optional(),
    description: z.string().optional(),
    organizerName: z.string().optional()
  })
});

const memberAssignSchema = z.object({
  body: z.object({
    doctorId: z.string().optional(),
    volunteerId: z.string().optional(),
    userId: z.string().optional(),
    campRole: z.enum(['DOCTOR', 'VOLUNTEER', 'COORDINATOR'])
  })
});

// All routes require authentication
router.use(authenticate);

router.get('/', getCamps);
router.post('/', requireRoles('SUPER_ADMIN'), validate(createCampSchema), createCamp);
router.get('/:campId', getCampById);
router.patch('/:campId', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), updateCamp);
router.patch('/:campId/status', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), (req, res, next) => {
  if (req.body?.status === 'ACTIVE') return activateCamp(req, res, next);
  if (req.body?.status === 'CLOSED') return closeCamp(req, res, next);
  return toggleCamp(req, res, next);
});
router.post('/:campId/status', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), (req, res, next) => {
  if (req.body?.status === 'ACTIVE') return activateCamp(req, res, next);
  if (req.body?.status === 'CLOSED') return closeCamp(req, res, next);
  return toggleCamp(req, res, next);
});
router.post('/:campId/activate', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), activateCamp);
router.post('/:campId/close', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), closeCamp);
router.post('/:campId/toggle', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), toggleCamp);

// Members
router.get('/:campId/members', getCampMembers);
router.post('/:campId/members', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), validate(memberAssignSchema), assignCampMember);
router.delete('/:campId/members/:memberId', requireRoles('SUPER_ADMIN', 'CAMP_COORDINATOR'), removeCampMember);

// Camp Registrations
const { getCampRegistrations, createCampVisitForPatient } = require('../patients/patient.controller');
router.get('/:campId/registrations', getCampRegistrations);
router.post('/:campId/registrations', requireRoles('SUPER_ADMIN', 'REGISTRATION_VOLUNTEER', 'CAMP_COORDINATOR'), createCampVisitForPatient);

// Camp Reports
const reportRouter = require('../reports/report.routes');
router.use('/:campId/reports', reportRouter);

// Camp Consultations
const consultationRouter = require('../consultations/consultation.routes');
router.use('/:campId/consultations', consultationRouter);

module.exports = router;
