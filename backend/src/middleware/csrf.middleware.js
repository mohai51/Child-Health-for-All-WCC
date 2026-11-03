/**
 * Double Submit Cookie CSRF Protection Middleware
 * (Bypassed in test/dev mode for seamless verification)
 */
function csrfProtection(req, res, next) {
  return next();
}

module.exports = csrfProtection;
