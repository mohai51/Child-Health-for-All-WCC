const Consultation = require('./consultation.model');
const Camp = require('../camps/camp.model');
const {
  searchPatientForConsultation,
  startConsultation,
  completeConsultation
} = require('./consultation.service');
const { logAuditEvent } = require('../../services/audit.service');

// Search patient by ID within assigned camp
async function verifyAndFindPatient(req, res) {
  try {
    const { patientId } = req.query;
    const { campId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'রোগীর আইডি লিখুন (Patient ID required)'
      });
    }

    const data = await searchPatientForConsultation({
      patientIdStr: patientId,
      campId,
      doctorUserId: req.user._id
    });

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Start a consultation (Doctor clicks "চিকিৎসা শুরু করুন")
async function createConsultation(req, res) {
  try {
    const { campId } = req.params;
    const { patientId, visitId } = req.body;

    const consultation = await startConsultation({
      patientId,
      campId,
      visitId,
      doctorUserId: req.user._id
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CONSULTATION_START',
      resourceType: 'Consultation',
      resourceId: consultation._id,
      result: 'SUCCESS',
      req,
      metadata: { campId, patientId }
    });

    return res.status(201).json({
      success: true,
      message: 'পরামর্শ সেশন শুরু হয়েছে (Consultation started)',
      data: consultation
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'পরামর্শ শুরু করতে ব্যর্থ হয়েছে (Failed to start consultation)'
    });
  }
}

// Save consultation data (Diagnosis, notes, prescription image, referral)
async function saveConsultation(req, res) {
  try {
    const { consultationId } = req.params;
    const {
      diagnosis,
      quickCategories,
      notes,
      prescriptionImageAssetIds,
      referralRequired,
      referralData
    } = req.body;

    const result = await completeConsultation({
      consultationId,
      doctorUserId: req.user._id,
      diagnosis,
      quickCategories,
      notes,
      prescriptionImageAssetIds,
      referralRequired,
      referralData
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CONSULTATION_COMPLETE',
      resourceType: 'Consultation',
      resourceId: consultationId,
      result: 'SUCCESS',
      req,
      metadata: {
        referralRequired: Boolean(referralRequired)
      }
    });

    return res.json({
      success: true,
      message: 'পরামর্শ ও প্রেসক্রিপশন সফলভাবে সংরক্ষণ করা হয়েছে (Consultation saved successfully)',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'পরামর্শ সংরক্ষণ ব্যর্থ হয়েছে (Failed to save consultation)'
    });
  }
}

// Get single consultation by ID
async function getConsultationById(req, res) {
  try {
    const { consultationId } = req.params;
    const consultation = await Consultation.findById(consultationId)
      .populate('patientId')
      .populate('doctorId', 'fullName specialty designation hospital bmdcNumber')
      .populate('campId', 'name campCode date venue status')
      .populate('prescriptionImageAssetIds');

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'পরামর্শ রেকর্ড পাওয়া যায়নি (Consultation not found)'
      });
    }

    // Role check: Only Doctor or Super Admin can inspect consultation details
    if (req.user.role === 'REGISTRATION_VOLUNTEER') {
      return res.status(403).json({
        success: false,
        message: 'স্বেচ্ছাসেবকদের চিকিৎসা বিস্তারিত দেখার অনুমতি নেই (Access denied)'
      });
    }

    return res.json({
      success: true,
      data: consultation
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'পরামর্শ আনতে সমস্যা হয়েছে (Failed to get consultation)',
      error: error.message
    });
  }
}

// Get all consultations for a camp
async function getCampConsultations(req, res) {
  try {
    const { campId } = req.params;
    const query = { campId };

    // If logged-in user is a doctor, filter by their own consultations unless Super Admin
    if (req.user.role === 'DOCTOR' && req.doctor) {
      query.doctorId = req.doctor._id;
    }

    const consultations = await Consultation.find(query)
      .populate('patientId', 'patientId fullName ageYears sex guardianName')
      .populate('doctorId', 'fullName specialty designation')
      .populate('prescriptionImageAssetIds')
      .sort({ startedAt: -1 });

    return res.json({
      success: true,
      data: consultations
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'পরামর্শ তালিকা লোড করতে সমস্যা হয়েছে (Failed to fetch consultations)',
      error: error.message
    });
  }
}

module.exports = {
  verifyAndFindPatient,
  createConsultation,
  saveConsultation,
  getConsultationById,
  getCampConsultations
};
