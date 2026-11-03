const express = require('express');
const { z } = require('zod');
const { login, logout, getMe } = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('সঠিক ইমেইল ঠিকানা দিন (Valid email required)'),
    password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password min 6 chars)')
  })
});

router.post('/login', validate(loginSchema), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
