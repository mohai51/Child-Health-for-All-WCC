const { verifySessionToken } = require('../services/token.service');
const User = require('../modules/users/user.model');
const Doctor = require('../modules/doctors/doctor.model');
const logger = require('../config/logger');

/**
 * Authenticate incoming request via cookie or Authorization header
 * Strict Production Mode: Requires a valid session token (test bypass disabled)
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization header
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // 2. Check cookie
    if (!token && req.cookies?.wcc_session) {
      token = req.cookies.wcc_session;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'লগইন আবশ্যক। অনুগ্রহ করে লগইন করুন (Authentication required. Please log in)'
      });
    }

    const decoded = verifySessionToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'সেশনের মেয়াদ শেষ হয়েছে। পুনরায় লগইন করুন (Session expired or invalid)'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.accountStatus !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'অ্যাকাউন্ট নিষ্ক্রিয় বা পাওয়া যায়নি (Account inactive or not found)'
      });
    }

    req.user = user;

    // If role is DOCTOR, resolve linked doctor profile
    if (user.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: user._id });
      if (doctor) {
        req.doctor = doctor;
      }
    }

    next();
  } catch (error) {
    logger.error({ error: error.message }, 'Authentication error');
    return res.status(401).json({
      success: false,
      message: 'লগইন যাচাইকরণ ব্যর্থ হয়েছে (Authentication verification failed)'
    });
  }
}

/**
 * Optional authentication (sets req.user if valid token present, otherwise proceeds)
 */
async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.wcc_session;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = verifySessionToken(token);
      if (decoded?.userId) {
        const user = await User.findById(decoded.userId);
        if (user && user.accountStatus === 'ACTIVE') {
          req.user = user;
          if (user.role === 'DOCTOR') {
            req.doctor = await Doctor.findOne({ userId: user._id });
          }
        }
      }
    }
  } catch (e) {
    // Ignore optional auth error
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth
};
