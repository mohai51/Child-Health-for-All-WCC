const mongoose = require('mongoose');
const Consultation = require('./consultation.model');
const Visit = require('../visits/visit.model');
const Patient = require('../patients/patient.model');
const Camp = require('../camps/camp.model');
const Doctor = require('../doctors/doctor.model');
const User = require('../users/user.model');
const CampMember = require('../camps/campMember.model');
const Referral = require('../referrals/referral.model');

/**
 * Doctor searches for patient in an active camp using Patient ID (e.g. WCC-000001), short number, token, phone, or name
 */
async function searchPatientForConsultation({ patientIdStr, campId, doctorUserId }) {
  // 1. Verify camp existence
  let camp = null;
  if (campId && mongoose.Types.ObjectId.isValid(campId)) {
    camp = await Camp.findById(campId);
  }
  if (!camp) {
    camp = await Camp.findOne({ status: 'ACTIVE' });
  }
  if (!camp) {
    camp = await Camp.findOne().sort({ createdAt: -1 });
  }
  if (!camp) {
    camp = await Camp.create({
      campCode: `CAMP-${new Date().getFullYear()}-002`,
      name: 'Child Health For All - 8 no Ward Jhalokathi [UMB]',
      date: new Date(),
      district: 'ঝালকাঠি',
      upazila: 'ঝালকাঠি সদর',
      venue: 'উদ্বোধন মাধ্যমিক বিদ্যালয়',
      isPourashava: true,
      pourashavaName: 'ঝালকাঠি',
      description: 'উই ক্যান চেঞ্জ (WCC) শিশু স্বাস্থ্য সেবা ও পুষ্টি ক্যাম্প ২০২৬',
      organizerName: 'We Can Change (WCC)',
      status: 'ACTIVE'
    });
  }

  // 2. Resolve Doctor profile
  let doctor = null;
  if (doctorUserId && mongoose.Types.ObjectId.isValid(doctorUserId)) {
    doctor = await Doctor.findOne({ userId: doctorUserId });
  }
  if (!doctor) {
    doctor = await Doctor.findOne({ status: 'ACTIVE' }) || await Doctor.findOne();
  }

  // 3. Normalize Query (handle Bangla digits, spaces, WCC-1, partial digits, etc.)
  const rawStr = String(patientIdStr || '').trim();
  if (!rawStr) {
    throw new Error('রোগীর আইডি বা মোবাইল নম্বর লিখুন');
  }

  const bnToEn = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const normStr = rawStr.replace(/[০-৯]/g, d => bnToEn[d]).trim();
  const upperStr = normStr.toUpperCase();

  // Extract digits for padded WCC format
  const digitsOnly = normStr.replace(/\D/g, '');
  const paddedId = digitsOnly ? `WCC-${digitsOnly.padStart(6, '0')}` : null;

  // Build flexible search conditions
  const patientConditions = [
    { patientId: upperStr },
    { patientId: new RegExp(`^${upperStr}$`, 'i') },
    { guardianPhone: normStr },
    { fullName: new RegExp(rawStr, 'i') }
  ];

  if (paddedId) {
    patientConditions.unshift({ patientId: paddedId });
  }

  if (digitsOnly.length >= 4) {
    patientConditions.push({ guardianPhone: new RegExp(digitsOnly, 'i') });
  }

  let patient = await Patient.findOne({ $or: patientConditions });

  // 4. Fallback search by camp token number
  if (!patient && digitsOnly) {
    const tokenNum = parseInt(digitsOnly, 10);
    const tokenVisit = await Visit.findOne({ campId: camp._id, visitToken: tokenNum }).populate('patientId');
    if (tokenVisit && tokenVisit.patientId) {
      patient = tokenVisit.patientId;
    }
  }

  // 5. Fallback search by partial patientId
  if (!patient && digitsOnly) {
    patient = await Patient.findOne({ patientId: new RegExp(digitsOnly, 'i') });
  }

  if (!patient) {
    throw new Error(`রোগী '${rawStr}' ডাটাবেজে পাওয়া যায়নি (Patient not found by ID, Token, Phone or Name)`);
  }

  // 6. Verify or create Visit for this camp
  let visit = await Visit.findOne({ campId: camp._id, patientId: patient._id });
  if (!visit) {
    const count = await Visit.countDocuments({ campId: camp._id });

    // Ensure valid ObjectId for registeredBy
    let registeredBy = (doctorUserId && mongoose.Types.ObjectId.isValid(doctorUserId)) ? doctorUserId : null;
    if (!registeredBy && doctor?.userId) {
      registeredBy = doctor.userId;
    }
    if (!registeredBy) {
      const anyUser = await User.findOne();
      registeredBy = anyUser?._id;
    }

    visit = await Visit.create({
      campId: camp._id,
      patientId: patient._id,
      registeredBy, // MUST BE registeredBy, matching visit.model.js
      visitToken: count + 1,
      mainComplaint: patient.mainComplaint || 'সাধারণ স্বাস্থ্য পরীক্ষা'
    });
  }

  // 7. Find any previous consultations for this patient (medical history)
  const previousConsultations = await Consultation.find({ patientId: patient._id })
    .populate('doctorId', 'fullName specialty designation')
    .populate('campId', 'name date')
    .populate('prescriptionImageAssetIds')
    .sort({ startedAt: -1 });

  // 8. Check if this doctor already has an in-progress consultation with this patient
  let existingActiveConsultation = null;
  if (doctor && doctor._id) {
    existingActiveConsultation = await Consultation.findOne({
      patientId: patient._id,
      campId: camp._id,
      doctorId: doctor._id,
      status: 'IN_PROGRESS'
    });
  }

  // 9. Check if patient was already examined/completed in this camp or any camp
  let completedConsultation = await Consultation.findOne({
    patientId: patient._id,
    campId: camp._id,
    status: { $in: ['COMPLETED', 'REFERRED'] }
  })
    .populate('doctorId', 'fullName specialty designation')
    .populate('prescriptionImageAssetIds')
    .sort({ completedAt: -1, updatedAt: -1 });

  if (!completedConsultation) {
    completedConsultation = await Consultation.findOne({
      patientId: patient._id,
      status: { $in: ['COMPLETED', 'REFERRED'] }
    })
      .populate('doctorId', 'fullName specialty designation')
      .populate('prescriptionImageAssetIds')
      .sort({ completedAt: -1, updatedAt: -1 });
  }

  let referralInfo = null;
  if (completedConsultation) {
    referralInfo = await Referral.findOne({
      consultationId: completedConsultation._id
    });
  }

  const isAlreadyConsulted = Boolean(completedConsultation || visit?.status === 'COMPLETED');

  // Find any prescription image asset ID and URL across completed & previous consultations
  let prescriptionAssetId = null;
  let prescriptionDirectUrl = null;

  if (completedConsultation?.prescriptionImageAssetIds?.length) {
    for (const item of completedConsultation.prescriptionImageAssetIds) {
      if (item) {
        prescriptionAssetId = (typeof item === 'object' && item._id) ? item._id.toString() : item.toString();
        if (typeof item === 'object' && item.storageReference?.startsWith('http')) {
          prescriptionDirectUrl = item.storageReference;
        }
        break;
      }
    }
  }

  if (!prescriptionAssetId && Array.isArray(previousConsultations)) {
    for (const prev of previousConsultations) {
      if (prev.prescriptionImageAssetIds?.length) {
        for (const item of prev.prescriptionImageAssetIds) {
          if (item) {
            prescriptionAssetId = (typeof item === 'object' && item._id) ? item._id.toString() : item.toString();
            if (typeof item === 'object' && item.storageReference?.startsWith('http')) {
              prescriptionDirectUrl = item.storageReference;
            }
            break;
          }
        }
      }
      if (prescriptionAssetId) break;
    }
  }

  const cleanPrescriptionAssetIds = prescriptionAssetId ? [prescriptionAssetId] : [];

  return {
    patient,
    visit,
    doctor,
    camp,
    previousConsultations,
    activeConsultationId: existingActiveConsultation ? existingActiveConsultation._id : null,
    isAlreadyConsulted,
    completedConsultation: completedConsultation ? {
      _id: completedConsultation._id,
      doctorName: completedConsultation.doctorId?.fullName || completedConsultation.doctorName || 'চিকিৎসক',
      doctorSpecialty: completedConsultation.doctorId?.specialty || '',
      diagnosis: completedConsultation.diagnosis,
      notes: completedConsultation.notes,
      referralRequired: Boolean(completedConsultation.referralRequired || referralInfo),
      referredHospital: referralInfo?.referredHospital || completedConsultation.referralNotes || '',
      referralReason: referralInfo?.reason || '',
      completedAt: completedConsultation.completedAt || completedConsultation.updatedAt,
      prescriptionImageAssetIds: cleanPrescriptionAssetIds,
      prescriptionAssetId,
      prescriptionDirectUrl
    } : null
  };
}

/**
 * Start or resume a consultation session
 */
async function startConsultation({ patientId, campId, visitId, doctorUserId }) {
  let doctor = null;
  if (doctorUserId && mongoose.Types.ObjectId.isValid(doctorUserId)) {
    doctor = await Doctor.findOne({ userId: doctorUserId });
  }
  if (!doctor) {
    doctor = await Doctor.findOne({ status: 'ACTIVE' }) || await Doctor.findOne();
  }
  if (!doctor) {
    throw new Error('চিকিৎসক প্রোফাইল পাওয়া যায়নি (Doctor profile not found)');
  }

  let camp = null;
  if (campId && mongoose.Types.ObjectId.isValid(campId)) {
    camp = await Camp.findById(campId);
  }
  if (!camp) {
    camp = await Camp.findOne({ status: 'ACTIVE' }) || await Camp.findOne().sort({ createdAt: -1 });
  }
  if (!camp) {
    camp = await Camp.create({
      campCode: `CAMP-${new Date().getFullYear()}-002`,
      name: 'Child Health For All - 8 no Ward Jhalokathi [UMB]',
      date: new Date(),
      district: 'ঝালকাঠি',
      upazila: 'ঝালকাঠি সদর',
      venue: 'উদ্বোধন মাধ্যমিক বিদ্যালয়',
      isPourashava: true,
      pourashavaName: 'ঝালকাঠি',
      description: 'উই ক্যান চেঞ্জ (WCC) শিশু স্বাস্থ্য সেবা ও পুষ্টি ক্যাম্প ২০২৬',
      organizerName: 'We Can Change (WCC)',
      status: 'ACTIVE'
    });
  }
  if (camp.status !== 'ACTIVE') {
    camp.status = 'ACTIVE';
    await camp.save();
  }

  let consultation = await Consultation.findOne({
    patientId,
    campId,
    doctorId: doctor._id,
    status: 'IN_PROGRESS'
  });

  if (!consultation) {
    const validDoctorUserId = (doctorUserId && mongoose.Types.ObjectId.isValid(doctorUserId))
      ? doctorUserId
      : doctor.userId;

    consultation = await Consultation.create({
      patientId,
      campId,
      visitId,
      doctorId: doctor._id,
      doctorUserId: validDoctorUserId,
      doctorName: `Dr. ${doctor.fullName}`,
      status: 'IN_PROGRESS',
      startedAt: new Date()
    });

    await Visit.findByIdAndUpdate(visitId, { status: 'IN_CONSULTATION' });
  }

  return consultation;
}

/**
 * Complete and save consultation records
 */
async function completeConsultation({
  consultationId,
  doctorUserId,
  diagnosis,
  quickCategories = [],
  notes = '',
  prescriptionImageAssetIds = [],
  referralRequired = false,
  referralData = null
}) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) {
    throw new Error('চিকিৎসা রেকর্ড পাওয়া যায়নি (Consultation not found)');
  }

  let doctor = null;
  if (doctorUserId && mongoose.Types.ObjectId.isValid(doctorUserId)) {
    doctor = await Doctor.findOne({ userId: doctorUserId });
  }
  if (!doctor && consultation.doctorId) {
    doctor = await Doctor.findById(consultation.doctorId);
  }
  if (!doctor) {
    doctor = await Doctor.findOne({ status: 'ACTIVE' }) || await Doctor.findOne();
  }

  consultation.diagnosis = diagnosis || 'সাধারণ স্বাস্থ্য পরীক্ষা ও প্রেসক্রিপশন';
  consultation.quickCategories = quickCategories || [];
  consultation.notes = notes || '';
  if (Array.isArray(prescriptionImageAssetIds) && prescriptionImageAssetIds.length > 0) {
    consultation.prescriptionImageAssetIds = prescriptionImageAssetIds;
  }
  consultation.referralRequired = Boolean(referralRequired);
  consultation.status = referralRequired ? 'REFERRED' : 'COMPLETED';
  consultation.completedAt = new Date();

  await consultation.save();

  // If referral is required, create Referral record
  let referral = null;
  if (referralRequired && referralData && doctor) {
    referral = await Referral.create({
      consultationId: consultation._id,
      patientId: consultation.patientId,
      campId: consultation.campId,
      referringDoctorId: doctor._id,
      referredHospital: referralData.referredHospital || 'জেলা সদর হাসপাতাল / মেডিকেল কলেজ',
      reason: referralData.reason || diagnosis || 'বিশেষজ্ঞ পরামর্শ ও ফলোআপ',
      followUpDate: referralData.followUpDate ? new Date(referralData.followUpDate) : null,
      followUpNotes: referralData.followUpNotes || ''
    });

    consultation.referralNotes = referralData.referredHospital
      ? `${referralData.referredHospital}${referralData.reason ? ' - ' + referralData.reason : ''}`
      : (referralData.reason || '');
    await consultation.save();
  }

  await Visit.findByIdAndUpdate(consultation.visitId, { status: 'COMPLETED' });

  return {
    consultation,
    referral
  };
}

module.exports = {
  searchPatientForConsultation,
  startConsultation,
  completeConsultation
};
