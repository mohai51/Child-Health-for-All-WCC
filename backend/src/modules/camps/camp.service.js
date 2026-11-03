const Camp = require('./camp.model');
const CampMember = require('./campMember.model');
const Visit = require('../visits/visit.model');
const Consultation = require('../consultations/consultation.model');
const Referral = require('../referrals/referral.model');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');
const { logAuditEvent } = require('../../services/audit.service');

/**
 * Generate unique sequential camp code: CAMP-YYYY-XXX
 */
async function generateCampCode() {
  const currentYear = new Date().getFullYear();
  const count = await Camp.countDocuments();
  const padded = String(count + 1).padStart(3, '0');
  let code = `CAMP-${currentYear}-${padded}`;

  // Check collision just in case
  let existing = await Camp.findOne({ campCode: code });
  let offset = 1;
  while (existing) {
    code = `CAMP-${currentYear}-${String(count + 1 + offset).padStart(3, '0')}`;
    existing = await Camp.findOne({ campCode: code });
    offset++;
  }
  return code;
}

/**
 * Calculate dynamic statistics for a specific camp
 */
async function getCampStats(campId) {
  const [
    totalVisits,
    totalConsultations,
    completedConsultations,
    referralsCount,
    assignedDoctorsCount,
    assignedVolunteersCount,
    uniquePatientsAggregation
  ] = await Promise.all([
    Visit.countDocuments({ campId }),
    Consultation.countDocuments({ campId }),
    Consultation.countDocuments({ campId, status: { $in: ['COMPLETED', 'REFERRED'] } }),
    Referral.countDocuments({ campId }),
    CampMember.countDocuments({ campId, campRole: 'DOCTOR' }),
    CampMember.countDocuments({ campId, campRole: 'VOLUNTEER' }),
    Consultation.aggregate([
      { $match: { campId } },
      { $group: { _id: '$patientId' } },
      { $count: 'uniquePatients' }
    ])
  ]);

  const uniquePatientsSeen = uniquePatientsAggregation[0]?.uniquePatients || 0;

  return {
    totalVisits, // Registered patients in this camp
    totalConsultations,
    completedConsultations,
    uniquePatientsSeen,
    referralsCount,
    assignedDoctorsCount,
    assignedVolunteersCount
  };
}

module.exports = {
  generateCampCode,
  getCampStats
};
