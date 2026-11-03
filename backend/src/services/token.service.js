const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a signed session JWT token
 */
function generateSessionToken(payload) {
  return jwt.sign(payload, config.sessionSecret, {
    expiresIn: config.sessionExpiresIn,
    issuer: 'wcc-child-health-registry',
    audience: 'wcc-users'
  });
}

/**
 * Verify and decode session JWT token
 */
function verifySessionToken(token) {
  try {
    return jwt.verify(token, config.sessionSecret, {
      issuer: 'wcc-child-health-registry',
      audience: 'wcc-users'
    });
  } catch (error) {
    return null;
  }
}

/**
 * Standard cookie configuration for session
 */
function getCookieOptions(isProduction = false) {
  return {
    httpOnly: true,
    secure: isProduction, // true in HTTPS production
    sameSite: 'lax', // Lax for first-party navigation & security
    maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
    path: '/'
  };
}

module.exports = {
  generateSessionToken,
  verifySessionToken,
  getCookieOptions
};
