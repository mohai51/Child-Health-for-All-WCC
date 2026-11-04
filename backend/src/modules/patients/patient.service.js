const mongoose = require('mongoose');
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
  // Check camp status with graceful fallback
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
  // Ensure camp is ACTIVE so field registration proceeds without block
  if (camp.status !== 'ACTIVE') {
    camp.status = 'ACTIVE';
    await camp.save();
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

  // Atomically calculate next visit token for this camp (thread-safe for concurrent volunteers)
  const visitToken = await Counter.getNextVisitToken(camp._id);

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
    throw new Error('ক্যাম্পটি খুঁজে পাওয়া যায়নি (Camp not found)');
  }
  if (camp.status !== 'ACTIVE') {
    camp.status = 'ACTIVE';
    await camp.save();
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

  // Atomically calculate next visit token for this camp (thread-safe for concurrent volunteers)
  const visitToken = await Counter.getNextVisitToken(camp._id);

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
