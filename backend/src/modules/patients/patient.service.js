const Patient = require('./patient.model');
const Counter = require('./counter.model');
const Visit = require('../visits/visit.model');
const Camp = require('../camps/camp.model');

/**
 * Register a new patient and automatically create a visit for the active camp
 */
async function registerNewPatient({
  campId,
  fullName,
  ageYears,
  ageMonths = 0,
  dateOfBirth = null,
  sex,
  guardianName,
  guardianPhone,
  district,
  upazila,
  isPourashava = false,
  pourashavaName = '',
  wardNo = '',
  weight,
  height,
  mainComplaint,
  relevantHealthNotes,
  registeredByUserId
}) {
  // Check camp status
  const camp = await Camp.findById(campId);
  if (!camp) {
    throw new Error('ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)');
  }
  if (camp.status !== 'ACTIVE') {
    throw new Error('এই ক্যাম্পটি বর্তমানে সক্রিয় নয়। নতুন রোগী নিবন্ধন সম্ভব নয় (Camp is not active)');
  }

  // Atomically generate next permanent Patient ID
  const patientId = await Counter.getNextPatientId();

  // Create Patient record
  const patient = await Patient.create({
    patientId,
    fullName,
    ageYears: Number(ageYears),
    ageMonths: Number(ageMonths || 0),
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    sex,
    guardianName,
    guardianPhone: guardianPhone || '',
    district,
    upazila,
    isPourashava: Boolean(isPourashava),
    pourashavaName: pourashavaName || '',
    wardNo: wardNo ? String(wardNo) : '',
    weight: weight ? Number(weight) : null,
    height: height ? Number(height) : null,
    mainComplaint: mainComplaint || '',
    relevantHealthNotes: relevantHealthNotes || '',
    createdBy: registeredByUserId
  });

  // Calculate visit token for this camp
  const currentVisitsCount = await Visit.countDocuments({ campId });
  const visitToken = currentVisitsCount + 1;

  // Create Camp Visit record
  const visit = await Visit.create({
    patientId: patient._id,
    campId: camp._id,
    visitToken,
    registeredBy: registeredByUserId,
    registeredAt: new Date(),
    status: 'REGISTERED',
    mainComplaint: mainComplaint || ''
  });

  return {
    patient,
    visit,
    camp: {
      id: camp._id,
      name: camp.name,
      campCode: camp.campCode
    }
  };
}

/**
 * Register a returning patient for a new camp visit using their existing Patient ID
 */
async function registerReturningPatient({ campId, patientRecordId, mainComplaint, registeredByUserId }) {
  const camp = await Camp.findById(campId);
  if (!camp) {
    throw new Error('ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)');
  }
  if (camp.status !== 'ACTIVE') {
    throw new Error('এই ক্যাম্পটি বর্তমানে সক্রিয় নয় (Camp is not active)');
  }

  const patient = await Patient.findById(patientRecordId);
  if (!patient) {
    throw new Error('রোগী খুঁজে পাওয়া যায়নি (Patient not found)');
  }

  // Check if patient already registered in this camp (duplicate prevention)
  const existingVisit = await Visit.findOne({ campId: camp._id, patientId: patient._id });
  if (existingVisit) {
    throw new Error('এই রোগী ইতিমধ্যে এই স্বাস্থ্য ক্যাম্পে নিবন্ধিত আছেন (Patient already registered in this camp)');
  }

  const currentVisitsCount = await Visit.countDocuments({ campId });
  const visitToken = currentVisitsCount + 1;

  const visit = await Visit.create({
    patientId: patient._id,
    campId: camp._id,
    visitToken,
    registeredBy: registeredByUserId,
    registeredAt: new Date(),
    status: 'REGISTERED',
    mainComplaint: mainComplaint || patient.mainComplaint || ''
  });

  return {
    patient,
    visit,
    camp: {
      id: camp._id,
      name: camp.name,
      campCode: camp.campCode
    }
  };
}

module.exports = {
  registerNewPatient,
  registerReturningPatient
};
