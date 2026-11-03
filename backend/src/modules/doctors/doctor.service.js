const Doctor = require('./doctor.model');
const User = require('../users/user.model');
const Consultation = require('../consultations/consultation.model');
const Referral = require('../referrals/referral.model');
const CampMember = require('../camps/campMember.model');
const { hashPassword } = require('../../utils/security');

/**
 * Get distinct and aggregated performance statistics for a specific doctor
 */
async function getDoctorStats(doctorId) {
  const [totalConsultations, totalReferrals, assignedCampsCount, uniquePatientsAgg] = await Promise.all([
    Consultation.countDocuments({ doctorId }),
    Referral.countDocuments({ referringDoctorId: doctorId }),
    CampMember.countDocuments({ doctorId, campRole: 'DOCTOR' }),
    Consultation.aggregate([
      { $match: { doctorId } },
      { $group: { _id: '$patientId' } },
      { $count: 'uniquePatients' }
    ])
  ]);

  const uniquePatientsSeen = uniquePatientsAgg[0]?.uniquePatients || 0;

  // Consultations grouped by camp
  const consultationsByCamp = await Consultation.aggregate([
    { $match: { doctorId } },
    {
      $group: {
        _id: '$campId',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'camps',
        localField: '_id',
        foreignField: '_id',
        as: 'camp'
      }
    },
    { $unwind: '$camp' },
    {
      $project: {
        campId: '$_id',
        campName: '$camp.name',
        campCode: '$camp.campCode',
        count: 1
      }
    }
  ]);

  return {
    totalConsultations,
    uniquePatientsSeen,
    totalReferrals,
    assignedCampsCount,
    consultationsByCamp
  };
}

module.exports = {
  getDoctorStats
};
