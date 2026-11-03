const Camp = require('../camps/camp.model');
const Patient = require('../patients/patient.model');
const Visit = require('../visits/visit.model');
const Consultation = require('../consultations/consultation.model');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');
const Referral = require('../referrals/referral.model');
const { getCampStats } = require('../camps/camp.service');

async function getMainDashboardStats(req, res) {
  try {
    const [
      totalCamps,
      activeCamps,
      closedCamps,
      totalUniquePatients,
      totalVisits,
      totalConsultations,
      totalDoctors,
      totalVolunteers,
      totalReferrals,
      camps
    ] = await Promise.all([
      Camp.countDocuments(),
      Camp.countDocuments({ status: 'ACTIVE' }),
      Camp.countDocuments({ status: 'CLOSED' }),
      Patient.countDocuments(),
      Visit.countDocuments(),
      Consultation.countDocuments(),
      Doctor.countDocuments({ accountStatus: 'ACTIVE' }),
      Volunteer.countDocuments({ accountStatus: 'ACTIVE' }),
      Referral.countDocuments(),
      Camp.find().sort({ date: -1, createdAt: -1 }).limit(10)
    ]);

    const campCards = await Promise.all(
      camps.map(async camp => {
        const stats = await getCampStats(camp._id);
        return {
          id: camp._id,
          campCode: camp.campCode,
          name: camp.name,
          date: camp.date,
          status: camp.status,
          district: camp.district,
          upazila: camp.upazila,
          venue: camp.venue,
          registeredPatients: stats.totalVisits,
          doctorsCount: stats.assignedDoctorsCount,
          volunteersCount: stats.assignedVolunteersCount,
          consultationsCount: stats.totalConsultations
        };
      })
    );

    return res.json({
      success: true,
      data: {
        summary: {
          totalCamps,
          activeCamps,
          closedCamps,
          totalUniquePatients,
          totalVisits,
          totalConsultations,
          totalDoctors,
          totalVolunteers,
          totalReferrals
        },
        camps: campCards
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'ড্যাশবোর্ড তথ্য লোড করতে ব্যর্থ হয়েছে (Failed to load dashboard stats)',
      error: error.message
    });
  }
}

module.exports = {
  getMainDashboardStats
};
