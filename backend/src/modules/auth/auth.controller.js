const { loginUser } = require('./auth.service');
const { getCookieOptions } = require('../../services/token.service');
const { logAuditEvent } = require('../../services/audit.service');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginUser(email, password, req);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('wcc_session', token, getCookieOptions(isProduction));

    return res.json({
      success: true,
      message: 'লগইন সফল হয়েছে (Login successful)',
      data: { user, token }
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.message || 'লগইন ব্যর্থ হয়েছে (Login failed)'
    });
  }
}

async function logout(req, res) {
  if (req.user) {
    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'USER_LOGOUT',
      resourceType: 'User',
      resourceId: req.user._id,
      result: 'SUCCESS',
      req
    });
  }

  res.clearCookie('wcc_session', { path: '/' });
  return res.json({
    success: true,
    message: 'লগআউট সম্পন্ন হয়েছে (Logged out successfully)'
  });
}

async function getMe(req, res) {
  const user = req.user;
  let doctor = null;
  let volunteer = null;

  if (user.role === 'DOCTOR') {
    doctor = await Doctor.findOne({ userId: user._id }).populate('profileImageAssetId');
  } else if (user.role === 'REGISTRATION_VOLUNTEER' || user.role === 'CAMP_COORDINATOR') {
    volunteer = await Volunteer.findOne({ userId: user._id }).populate('profileImageAssetId');
  }

  return res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        doctor,
        volunteer
      }
    }
  });
}

module.exports = {
  login,
  logout,
  getMe
};
