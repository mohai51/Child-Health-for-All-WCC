const User = require('../users/user.model');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');
const { verifyPassword, hashPassword } = require('../../utils/security');
const { generateSessionToken } = require('../../services/token.service');
const { logAuditEvent } = require('../../services/audit.service');

async function loginUser(email, plainPassword, req) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    await logAuditEvent({
      action: 'USER_LOGIN',
      resourceType: 'User',
      result: 'FAILURE',
      req,
      metadata: { email: normalizedEmail, reason: 'User not found' }
    });
    throw new Error('ভুল ইমেইল বা পাসওয়ার্ড (Invalid credentials)');
  }

  if (user.accountStatus !== 'ACTIVE') {
    await logAuditEvent({
      actorId: user._id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: user._id,
      result: 'DENIED',
      req,
      metadata: { reason: 'Account not active' }
    });
    throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় বা স্থগিত করা হয়েছে (Account is inactive or suspended)');
  }

  const isMatch = await verifyPassword(user.passwordHash, plainPassword);
  if (!isMatch) {
    await logAuditEvent({
      actorId: user._id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: user._id,
      result: 'FAILURE',
      req,
      metadata: { reason: 'Password mismatch' }
    });
    throw new Error('ভুল ইমেইল বা পাসওয়ার্ড (Invalid credentials)');
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Find linked doctor or volunteer if applicable
  let doctor = null;
  let volunteer = null;
  if (user.role === 'DOCTOR') {
    doctor = await Doctor.findOne({ userId: user._id });
  } else if (user.role === 'REGISTRATION_VOLUNTEER') {
    volunteer = await Volunteer.findOne({ userId: user._id });
  }

  const token = generateSessionToken({
    userId: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email
  });

  await logAuditEvent({
    actorId: user._id,
    actorRole: user.role,
    action: 'USER_LOGIN',
    resourceType: 'User',
    resourceId: user._id,
    result: 'SUCCESS',
    req
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      doctor: doctor ? { id: doctor._id, fullName: doctor.fullName, specialty: doctor.specialty } : null,
      volunteer: volunteer ? { id: volunteer._id, fullName: volunteer.fullName, responsibility: volunteer.responsibility } : null
    },
    token
  };
}

module.exports = {
  loginUser
};
