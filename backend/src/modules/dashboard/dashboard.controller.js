const Camp = require('../camps/camp.model');
const CampMember = require('../camps/campMember.model');
const Patient = require('../patients/patient.model');
const Visit = require('../visits/visit.model');
const Consultation = require('../consultations/consultation.model');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');
const Referral = require('../referrals/referral.model');

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
      Camp.find().sort({ date: -1, createdAt: -1 }).limit(10).lean()
    ]);

    const campIds = camps.map(c => c._id);

    // Batch aggregate recent camp stats in parallel rather than N*7 queries
    const [visitAgg, consultAgg, memberAgg] = await Promise.all([
      Visit.aggregate([
        { $match: { campId: { $in: campIds } } },
        { $group: { _id: '$campId', totalVisits: { $sum: 1 } } }
      ]),
      Consultation.aggregate([
        { $match: { campId: { $in: campIds } } },
        { $group: { _id: '$campId', totalConsultations: { $sum: 1 } } }
      ]),
      CampMember.aggregate([
        { $match: { campId: { $in: campIds } } },
        {
          $group: {
            _id: { campId: '$campId', role: '$campRole' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const visitMap = {};
    visitAgg.forEach(v => { visitMap[v._id.toString()] = v.totalVisits || 0; });

    const consultMap = {};
    consultAgg.forEach(c => { consultMap[c._id.toString()] = c.totalConsultations || 0; });

    const memberMap = {};
    memberAgg.forEach(m => {
      const cId = m._id.campId.toString();
      if (!memberMap[cId]) memberMap[cId] = { DOCTOR: 0, VOLUNTEER: 0 };
      memberMap[cId][m._id.role] = m.count || 0;
    });

    const campCards = camps.map(camp => {
      const cId = camp._id.toString();
      const mData = memberMap[cId] || {};
      return {
        id: camp._id,
        campCode: camp.campCode,
        name: camp.name,
        date: camp.date,
        status: camp.status,
        district: camp.district,
        upazila: camp.upazila,
        venue: camp.venue,
        registeredPatients: visitMap[cId] || 0,
        doctorsCount: mData['DOCTOR'] || 0,
        volunteersCount: mData['VOLUNTEER'] || 0,
        consultationsCount: consultMap[cId] || 0
      };
    });

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
