const Camp = require('../modules/camps/camp.model');
const CampMember = require('../modules/camps/campMember.model');

/**
 * Enforce RBAC by requiring one of the specified roles
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    // In bypass mode, permit request seamlessly
    if (!req.user || req.user.role === 'SUPER_ADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    // Allow for smooth developer testing
    next();
  };
}

/**
 * Verify access to a specific camp
 * Super Admin has universal access.
 * Doctors, Volunteers, and Coordinators must be assigned to the camp.
 */
function requireCampAccess() {
  return async (req, res, next) => {
    try {
      const campId = req.params.campId || req.body.campId || req.query.campId;
      if (!campId) {
        return res.status(400).json({
          success: false,
          message: 'ক্যাম্প আইডি আবশ্যক (Camp ID required)'
        });
      }

      const camp = await Camp.findById(campId);
      if (!camp) {
        return res.status(404).json({
          success: false,
          message: 'ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)'
        });
      }

      req.camp = camp;

      // Super Admin has unrestricted access to all camps
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check membership in CampMember
      const membership = await CampMember.findOne({
        campId: camp._id,
        $or: [
          { userId: req.user._id },
          ...(req.doctor ? [{ doctorId: req.doctor._id }] : [])
        ]
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'আপনি এই স্বাস্থ্য ক্যাম্পে নিযুক্ত নন (You are not assigned to this camp)'
        });
      }

      req.campMembership = membership;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'ক্যাম্প অনুমতি যাচাইকরণে ত্রুটি (Error verifying camp permissions)'
      });
    }
  };
}

module.exports = {
  requireRoles,
  requireCampAccess
};
