const express = require('express');
const { z } = require('zod');
const { getVolunteers, createVolunteer, updateVolunteer, deleteVolunteer } = require('./volunteer.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router();

const createVolunteerSchema = z.object({
  body: z.object({
    fullName: z.string().min(3, 'স্বেচ্ছাসেবকের নাম দিন (Name required)'),
    phone: z.string().min(6, 'মোবাইল নম্বর দিন (Phone required)'),
    email: z.string().email().optional().or(z.literal('')),
    password: z.string().optional().or(z.literal('')),
    responsibility: z.enum([
      'Registration Desk',
      'Doctor Assistant',
      'Pharmacy',
      'Coordination',
      'General Support'
    ]),
    createLoginAccount: z.boolean().optional(),
    profileImageAssetId: z.string().optional().nullable(),
    assignedCampId: z.string().optional().nullable()
  })
});

router.use(authenticate);

router.get('/', getVolunteers);
router.post('/', requireRoles('SUPER_ADMIN'), validate(createVolunteerSchema), createVolunteer);
router.patch('/:volunteerId', requireRoles('SUPER_ADMIN'), updateVolunteer);
router.delete('/:volunteerId', requireRoles('SUPER_ADMIN'), deleteVolunteer);

module.exports = router;
