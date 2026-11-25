const mongoose = require('mongoose');
const Patient = require('../patients/patient.model');
const Visit = require('../visits/visit.model');
const Camp = require('../camps/camp.model');
const Consultation = require('../consultations/consultation.model');
const { logAuditEvent } = require('../../services/audit.service');

/**
 * Evaluate pediatric Mid-Upper Arm Circumference (MUAC) based on WHO guidelines
 * < 11.5 cm : Severe Acute Malnutrition (SAM)
 * 11.5 - 12.4 cm : Moderate Acute Malnutrition (MAM)
 * >= 12.5 cm : Normal Nutritional Status
 * 
 * @param {number} muacCm 
 */
function evaluateMUAC(muacCm) {
  const m = parseFloat(muacCm);
  if (!m || isNaN(m) || m <= 0) {
    return {
      muac: null,
      muacStatus: '',
      statusClass: '',
      statusColor: '#64748b'
    };
  }

  let muacStatus = 'স্বাভাবিক (Normal)';
  let statusClass = 'status-normal';
  let statusColor = '#16a34a';

  if (m < 11.5) {
    muacStatus = 'তীব্র অপুষ্টি (SAM)';
    statusClass = 'status-underweight';
    statusColor = '#dc2626';
  } else if (m <= 12.4) {
    muacStatus = 'মাঝারি অপুষ্টি (MAM)';
    statusClass = 'status-overweight';
    statusColor = '#d97706';
  } else {
    muacStatus = 'স্বাভাবিক (Normal)';
    statusClass = 'status-normal';
    statusColor = '#16a34a';
  }

  return {
    muac: m,
    muacStatus,
    statusClass,
    statusColor
  };
}

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

  // 2. Normalize Bangla digits to English digits
  const bnToEn = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const normQuery = rawQuery.replace(/[০-৯]/g, d => bnToEn[d]).trim();

  let patient = null;
  let visit = null;

  // 3. Check if query is purely numeric (Token number in this camp or numeric ID)
  const isNumericOnly = /^\d+$/.test(normQuery);
  const isWccPattern = /^WCC-?\d+$/i.test(normQuery);

  if (isNumericOnly && normQuery.length <= 5) {
    // In a health camp, a 1-5 digit number entered in the search box is primarily the Token Number for THIS camp
    const tokenNum = parseInt(normQuery, 10);
    if (!isNaN(tokenNum) && tokenNum > 0) {
      const tokenVisit = await Visit.findOne({ campId: camp._id, visitToken: tokenNum }).populate('patientId');
      if (tokenVisit && tokenVisit.patientId) {
        patient = tokenVisit.patientId;
        visit = tokenVisit;
      }
    }
  }

  // 4. If not found by camp token, resolve Patient (by WCC ID, 6-digit WCC suffix, phone, or name)
  if (!patient) {
    if (isWccPattern) {
      const formattedId = normQuery.replace(/^WCC-?/i, 'WCC-').toUpperCase();
      patient = await Patient.findOne({ patientId: formattedId });
      if (!patient) {
        const numPart = normQuery.replace(/\D/g, '');
        const paddedId = `WCC-${numPart.padStart(6, '0')}`;
        patient = await Patient.findOne({ patientId: paddedId });
      }
    } else if (isNumericOnly && normQuery.length === 6) {
      const paddedId = `WCC-${normQuery.padStart(6, '0')}`;
      patient = await Patient.findOne({ patientId: paddedId });
      if (!patient) {
        patient = await Patient.findOne({ guardianPhone: normQuery });
      }
    } else if (isNumericOnly && normQuery.length > 6) {
      patient = await Patient.findOne({ guardianPhone: normQuery });
    } else {
      patient = await Patient.findOne({
        $or: [
          { patientId: new RegExp(`^${normQuery}$`, 'i') },
          { guardianPhone: normQuery },
          { fullName: new RegExp(rawQuery, 'i') }
        ]
      });
    }
  }

  if (!patient) {
    throw new Error(`টোকেন বা রোগী "${rawQuery}" খুঁজে পাওয়া যায়নি (Patient not found by Token, ID, Phone or Name)`);
  }

  // 5. Strictly enforce camp visit isolation (No cross-camp data leaks!)
  if (!visit) {
    visit = await Visit.findOne({
      patientId: patient._id,
      campId: camp._id
    });
  }

  if (!visit) {
    throw new Error(`রোগী "${patient.fullName} (${patient.patientId})" এই স্বাস্থ্য ক্যাম্পে নিবন্ধিত নন। অনুগ্রহ করে রেজিস্ট্রেশন ডেস্ক থেকে আগে এই ক্যাম্পের জন্য নিবন্ধন বা টোকেন সংগ্রহ করুন।`);
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
      muac: patient.muac || null,
      muacStatus: patient.muacStatus || '',
      bloodGroup: patient.bloodGroup || '',
      hemoglobin: patient.hemoglobin || '',
      bmi: patient.bmi || bmiInfo.bmi,
      bmiStatus: patient.bmiStatus || bmiInfo.bmiStatus,
      mainComplaint: patient.mainComplaint || ''
    },
    bmiInfo,
    muacInfo: evaluateMUAC(patient.muac),
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
  muac = null,
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
  const parsedMuac = (muac !== undefined && muac !== null && muac !== '') ? parseFloat(muac) : null;
  const cleanBloodGroup = String(bloodGroup || '').trim();
  let cleanHb = String(hemoglobin || '').replace(/%/g, '').trim();

  // Compute BMI and Category
  const bmiInfo = calculateChildBMI(parsedWeight, parsedHeight, patient.ageYears, patient.sex);
  const muacInfo = evaluateMUAC(parsedMuac);

  // Update Patient document
  if (parsedHeight !== null) patient.height = parsedHeight;
  if (parsedWeight !== null) patient.weight = parsedWeight;
  if (parsedMuac !== null) {
    patient.muac = parsedMuac;
    patient.muacStatus = muacInfo.muacStatus;
  }
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
      if (parsedMuac !== null) {
        consultation.muac = parsedMuac;
        consultation.muacStatus = muacInfo.muacStatus;
      }
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
        muac: parsedMuac,
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
    muacInfo,
    message: 'পরিমাপ সফলভাবে সংরক্ষিত হয়েছে! এবার রোগীকে ডাক্তারের কাছে যেতে পারেন।'
  };
}

module.exports = {
  calculateChildBMI,
  evaluateMUAC,
  searchPatientForMeasurement,
  savePatientMeasurement
};

