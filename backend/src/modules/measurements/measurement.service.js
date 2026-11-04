const mongoose = require('mongoose');
const Patient = require('../patients/patient.model');
const Visit = require('../visits/visit.model');
const Camp = require('../camps/camp.model');
const Consultation = require('../consultations/consultation.model');
const { logAuditEvent } = require('../../services/audit.service');

/**
 * Calculate pediatric Body Mass Index (BMI) and health status category
 * Based on WHO / CDC pediatric growth standards
 * 
 * @param {number} weightKg - Patient weight in kilograms
 * @param {number} heightCm - Patient height in centimeters
 * @param {number} ageYears - Age in years
 * @param {string} sex - 'MALE' | 'FEMALE' | 'OTHER'
 */
function calculateChildBMI(weightKg, heightCm, ageYears = 5, sex = 'MALE') {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);

  if (!w || !h || w <= 0 || h <= 0) {
    return {
      bmi: null,
      bmiStatus: '',
      statusClass: '',
      statusColor: '#64748b'
    };
  }

  const heightM = h / 100;
  const bmi = parseFloat((w / (heightM * heightM)).toFixed(1));

  let bmiStatus = 'স্বাভাবিক ওজন (Healthy Weight)';
  let statusClass = 'status-normal';
  let statusColor = '#16a34a'; // Green

  const age = parseInt(ageYears || 5, 10);

  if (age <= 5) {
    if (bmi < 13.5) {
      bmiStatus = 'কম ওজন / অপুষ্টি (Underweight)';
      statusClass = 'status-underweight';
      statusColor = '#dc2626'; // Red
    } else if (bmi <= 17.5) {
      bmiStatus = 'স্বাভাবিক ওজন (Healthy Weight)';
      statusClass = 'status-normal';
      statusColor = '#16a34a'; // Green
    } else if (bmi <= 19.0) {
      bmiStatus = 'অতিরিক্ত ওজন (Overweight)';
      statusClass = 'status-overweight';
      statusColor = '#d97706'; // Amber
    } else {
      bmiStatus = 'স্থূলতা (Obese)';
      statusClass = 'status-obese';
      statusColor = '#b91c1c'; // Deep Red
    }
  } else if (age <= 10) {
    if (bmi < 14.0) {
      bmiStatus = 'কম ওজন (Underweight)';
      statusClass = 'status-underweight';
      statusColor = '#dc2626';
    } else if (bmi <= 19.5) {
      bmiStatus = 'স্বাভাবিক ওজন (Healthy Weight)';
      statusClass = 'status-normal';
      statusColor = '#16a34a';
    } else if (bmi <= 22.0) {
      bmiStatus = 'অতিরিক্ত ওজন (Overweight)';
      statusClass = 'status-overweight';
      statusColor = '#d97706';
    } else {
      bmiStatus = 'স্থূলতা (Obese)';
      statusClass = 'status-obese';
      statusColor = '#b91c1c';
    }
  } else if (age <= 14) {
    if (bmi < 15.5) {
      bmiStatus = 'কম ওজন (Underweight)';
      statusClass = 'status-underweight';
      statusColor = '#dc2626';
    } else if (bmi <= 22.5) {
      bmiStatus = 'স্বাভাবিক ওজন (Healthy Weight)';
      statusClass = 'status-normal';
      statusColor = '#16a34a';
    } else if (bmi <= 26.0) {
      bmiStatus = 'অতিরিক্ত ওজন (Overweight)';
      statusClass = 'status-overweight';
      statusColor = '#d97706';
    } else {
      bmiStatus = 'স্থূলতা (Obese)';
      statusClass = 'status-obese';
      statusColor = '#b91c1c';
    }
  } else {
    // 15 to 18 years
    if (bmi < 18.5) {
      bmiStatus = 'কম ওজন (Underweight)';
      statusClass = 'status-underweight';
      statusColor = '#dc2626';
    } else if (bmi <= 24.9) {
      bmiStatus = 'স্বাভাবিক ওজন (Healthy Weight)';
      statusClass = 'status-normal';
      statusColor = '#16a34a';
    } else if (bmi <= 29.9) {
      bmiStatus = 'অতিরিক্ত ওজন (Overweight)';
      statusClass = 'status-overweight';
      statusColor = '#d97706';
    } else {
      bmiStatus = 'স্থূলতা (Obese)';
      statusClass = 'status-obese';
      statusColor = '#b91c1c';
    }
  }

  return {
    bmi,
    bmiStatus,
    statusClass,
    statusColor
  };
}

/**
 * Search patient for measurement desk
 */
async function searchPatientForMeasurement({ patientQuery, campId }) {
  if (!patientQuery || !patientQuery.trim()) {
    throw new Error('রোগীর আইডি বা ফোন নম্বর লিখুন (Patient query required)');
  }

  const rawQuery = patientQuery.trim();

  // 1. Resolve Camp
  let camp = null;
  if (campId && mongoose.Types.ObjectId.isValid(campId)) {
    camp = await Camp.findById(campId);
  }
  if (!camp) {
    camp = await Camp.findOne({ status: 'ACTIVE' }) || await Camp.findOne().sort({ createdAt: -1 });
  }
  if (!camp) {
    throw new Error('কোনো স্বাস্থ্য ক্যাম্প পাওয়া যায়নি (Camp not found)');
  }

  // 2. Resolve Patient (by WCC ID, normalized numeric suffix, or phone)
  let patient = null;
  const isWccPattern = /^WCC-?\d+$/i.test(rawQuery);
  const isNumericOnly = /^\d+$/.test(rawQuery);

  if (isWccPattern) {
    const formattedId = rawQuery.replace(/^WCC-?/i, 'WCC-').toUpperCase();
    patient = await Patient.findOne({ patientId: formattedId });
    if (!patient) {
      const numPart = rawQuery.replace(/\D/g, '');
      const paddedId = `WCC-${numPart.padStart(6, '0')}`;
      patient = await Patient.findOne({ patientId: paddedId });
    }
  } else if (isNumericOnly && rawQuery.length <= 6) {
    const paddedId = `WCC-${rawQuery.padStart(6, '0')}`;
    patient = await Patient.findOne({ patientId: paddedId });
    if (!patient) {
      patient = await Patient.findOne({ guardianPhone: rawQuery });
    }
  } else {
    patient = await Patient.findOne({
      $or: [
        { patientId: new RegExp(`^${rawQuery}$`, 'i') },
        { guardianPhone: rawQuery },
        { fullName: new RegExp(rawQuery, 'i') }
      ]
    });
  }

  if (!patient) {
    throw new Error(`রোগী "${rawQuery}" খুঁজে পাওয়া যায়নি (Patient not found)`);
  }

  // 3. Resolve Visit for this camp
  let visit = await Visit.findOne({
    patientId: patient._id,
    campId: camp._id
  });

  if (!visit) {
    // If patient is not yet registered in this specific camp, find their latest visit
    visit = await Visit.findOne({ patientId: patient._id }).sort({ createdAt: -1 });
  }

  // Compute live BMI if values exist
  const bmiInfo = calculateChildBMI(patient.weight, patient.height, patient.ageYears, patient.sex);

  // Check if measured previously
  const isAlreadyMeasured = Boolean(patient.height && patient.weight);

  return {
    patient: {
      _id: patient._id,
      patientId: patient.patientId,
      fullName: patient.fullName,
      ageYears: patient.ageYears,
      ageMonths: patient.ageMonths,
      sex: patient.sex,
      guardianName: patient.guardianName,
      guardianPhone: patient.guardianPhone,
      district: patient.district,
      upazila: patient.upazila,
      weight: patient.weight,
      height: patient.height,
      bloodGroup: patient.bloodGroup || '',
      hemoglobin: patient.hemoglobin || '',
      bmi: patient.bmi || bmiInfo.bmi,
      bmiStatus: patient.bmiStatus || bmiInfo.bmiStatus,
      mainComplaint: patient.mainComplaint || ''
    },
    bmiInfo,
    visit: visit ? {
      _id: visit._id,
      visitToken: visit.visitToken,
      status: visit.status,
      mainComplaint: visit.mainComplaint || patient.mainComplaint
    } : null,
    camp: {
      _id: camp._id,
      name: camp.name,
      campCode: camp.campCode,
      date: camp.date
    },
    isAlreadyMeasured
  };
}

/**
 * Save / Update patient measurement and vitals
 */
async function savePatientMeasurement({
  patientId,
  campId,
  height,
  weight,
  bloodGroup = '',
  hemoglobin = '',
  measuredByUserId,
  req
}) {
  if (!patientId) {
    throw new Error('রোগীর আইডি প্রদান আবশ্যক (Patient ID required)');
  }

  let patient = null;
  if (mongoose.Types.ObjectId.isValid(patientId)) {
    patient = await Patient.findById(patientId);
  }
  if (!patient) {
    patient = await Patient.findOne({ patientId: String(patientId).toUpperCase().trim() });
  }
  if (!patient) {
    throw new Error('রোগীর তথ্য পাওয়া যায়নি (Patient not found)');
  }

  const parsedHeight = (height !== undefined && height !== null && height !== '') ? parseFloat(height) : null;
  const parsedWeight = (weight !== undefined && weight !== null && weight !== '') ? parseFloat(weight) : null;
  const cleanBloodGroup = String(bloodGroup || '').trim();
  let cleanHb = String(hemoglobin || '').replace(/%/g, '').trim();

  // Compute BMI and Category
  const bmiInfo = calculateChildBMI(parsedWeight, parsedHeight, patient.ageYears, patient.sex);

  // Update Patient document
  if (parsedHeight !== null) patient.height = parsedHeight;
  if (parsedWeight !== null) patient.weight = parsedWeight;
  if (cleanBloodGroup) patient.bloodGroup = cleanBloodGroup;
  if (cleanHb) patient.hemoglobin = cleanHb;
  if (bmiInfo.bmi !== null) {
    patient.bmi = bmiInfo.bmi;
    patient.bmiStatus = bmiInfo.bmiStatus;
  }

  await patient.save();

  // If campId provided, find and sync any consultation in progress or completed
  if (campId && mongoose.Types.ObjectId.isValid(campId)) {
    const consultation = await Consultation.findOne({
      patientId: patient._id,
      campId
    });

    if (consultation) {
      if (cleanBloodGroup) consultation.bloodGroup = cleanBloodGroup;
      if (cleanHb) consultation.hemoglobin = cleanHb;
      if (bmiInfo.bmi !== null) {
        consultation.bmi = bmiInfo.bmi;
        consultation.bmiStatus = bmiInfo.bmiStatus;
      }
      await consultation.save();
    }
  }

  // Audit log
  if (measuredByUserId) {
    await logAuditEvent({
      actorId: measuredByUserId,
      actorRole: req?.user?.role || 'MEASUREMENT_OFFICER',
      action: 'PATIENT_MEASUREMENT_SAVED',
      resourceType: 'Patient',
      resourceId: patient._id,
      result: 'SUCCESS',
      metadata: {
        patientId: patient.patientId,
        height: parsedHeight,
        weight: parsedWeight,
        bmi: bmiInfo.bmi,
        bloodGroup: cleanBloodGroup,
        hemoglobin: cleanHb
      },
      req
    });
  }

  return {
    patient,
    bmiInfo,
    message: 'পরিমাপ সফলভাবে সংরক্ষিত হয়েছে! এবার রোগীকে ডাক্তারের কাছে যেতে পারেন।'
  };
}

module.exports = {
  calculateChildBMI,
  searchPatientForMeasurement,
  savePatientMeasurement
};

