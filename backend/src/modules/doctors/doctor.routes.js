const express = require('express');
const { z } = require('zod');
const { getDoctors, createDoctor, getDoctorById, updateDoctor } = require('./doctor.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRoles } = require('../../middleware/rbac.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router();

const createDoctorSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'চিকিৎসকের পূর্ণ নাম দিন (Full name required)'),
    specialty: z.string().min(2, 'কোন ধরণের শিশু রোগী দেখবেন তা লিখুন (Specialty required)'),
    phone: z.string().optional().default(''),
    email: z.string().email('সঠিক ইমেইল দিন (Valid email required)').optional().or(z.literal('')),
    password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে').optional().or(z.literal('')),
    assignedCampId: z.string().optional().nullable(),
    designation: z.string().optional().default('শিশু বিশেষজ্ঞ'),
    hospital: z.string().optional().default(''),
    bmdcNumber: z.string().optional().default(''),
    profileImageAssetId: z.string().optional().nullable(),
    photoUrl: z.string().optional().default('')
  })
});

router.use(authenticate);

router.get('/', getDoctors);
router.post('/', requireRoles('SUPER_ADMIN'), validate(createDoctorSchema), createDoctor);
router.get('/:doctorId', getDoctorById);
router.patch('/:doctorId', updateDoctor);

module.exports = router;
