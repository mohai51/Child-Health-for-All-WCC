const Patient = require('./patient.model');
const Visit = require('../visits/visit.model');
const Consultation = require('../consultations/consultation.model');
const { registerNewPatient, registerReturningPatient } = require('./patient.service');
const { logAuditEvent } = require('../../services/audit.service');

// Search patients by ID, phone, or name
async function searchPatients(req, res) {
  try {
    const { q, campId } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'অনুসন্ধানের জন্য কমপক্ষে ২ অক্ষর লিখুন (Query must be at least 2 characters)'
      });
    }

    const queryStr = q.trim();

    // Exact match for Patient ID, or regex for name/phone
    const searchFilter = {
      $or: [
        { patientId: new RegExp(`^${queryStr}$`, 'i') },
        { patientId: new RegExp(queryStr, 'i') },
        { guardianPhone: new RegExp(queryStr, 'i') },
        { fullName: new RegExp(queryStr, 'i') }
      ]
    };

    const patients = await Patient.find(searchFilter).limit(20).lean();

    // If campId is specified, batch-lookup visits in one single query instead of 20 sequential queries
    let visitMap = {};
    if (campId && patients.length > 0) {
      const patientIds = patients.map(p => p._id);
      const campVisits = await Visit.find({ patientId: { $in: patientIds }, campId }).lean();
      campVisits.forEach(v => {
        visitMap[v.patientId.toString()] = v;
      });
    }

    const results = patients.map(p => {
      const currentCampVisit = visitMap[p._id.toString()] || null;
      return {
        ...p,
        isRegisteredInSelectedCamp: Boolean(currentCampVisit),
        currentCampVisit
      };
    });

    return res.json({
      success: true,
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'রোগী অনুসন্ধানে সমস্যা হয়েছে (Search failed)',
      error: error.message
    });
  }
}

// Register new patient
async function createPatient(req, res) {
  try {
    const {
      campId,
      fullName,
      ageYears,
      ageMonths,
      dateOfBirth,
      sex,
      guardianName,
      guardianPhone,
      district,
      upazila,
      isPourashava,
      pourashavaName,
      wardNo,
      weight,
      height,
      mainComplaint,
      relevantHealthNotes,
      guardianConsent
    } = req.body;

    if (!guardianConsent) {
      return res.status(400).json({
        success: false,
        message: 'অভিভাবকের সম্মতি বাধ্যতামূলক (Guardian consent is mandatory)'
      });
    }

    const result = await registerNewPatient({
      campId,
      fullName,
      ageYears,
      ageMonths,
      dateOfBirth,
      sex,
      guardianName,
      guardianPhone,
      district,
      upazila,
      isPourashava,
      pourashavaName,
      wardNo,
      weight,
      height,
      mainComplaint,
      relevantHealthNotes,
      registeredByUserId: req.user._id
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'PATIENT_CREATE',
      resourceType: 'Patient',
      resourceId: result.patient._id,
      result: 'SUCCESS',
      req,
      metadata: { patientId: result.patient.patientId, campId }
    });

    return res.status(201).json({
      success: true,
      message: 'রোগী নিবন্ধন সফল হয়েছে (Patient registered successfully)',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'রোগী নিবন্ধন ব্যর্থ হয়েছে (Registration failed)'
    });
  }
}

// Register an existing patient for a new camp visit
async function createCampVisitForPatient(req, res) {
  try {
    const { campId } = req.params;
    const { patientRecordId, mainComplaint } = req.body;

    const result = await registerReturningPatient({
      campId,
      patientRecordId,
      mainComplaint,
      registeredByUserId: req.user._id
    });

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'PATIENT_CAMP_VISIT_CREATE',
      resourceType: 'Visit',
      resourceId: result.visit._id,
      result: 'SUCCESS',
      req,
      metadata: { patientId: result.patient.patientId, campId }
    });

    return res.status(201).json({
      success: true,
      message: 'ক্যাম্প ভিজিট সফলভাবে যুক্ত হয়েছে (Camp visit registered successfully)',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'ভিজিট যুক্ত করতে ব্যর্থ হয়েছে (Visit registration failed)'
    });
  }
}

// Get single patient by ID (e.g. WCC-000001 or MongoDB _id) with visits and consultation records
async function getPatientById(req, res) {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findOne({
      $or: [{ patientId: patientId.toUpperCase() }, ...(patientId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: patientId }] : [])]
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'রোগী পাওয়া যায়নি (Patient not found)'
      });
    }

    // Get all visits
    const visits = await Visit.find({ patientId: patient._id })
      .populate('campId', 'name campCode date status venue')
      .populate('registeredBy', 'name')
      .sort({ registeredAt: -1 })
      .lean();

    // Role-limited medical history:
    // Only Doctors and Super Admins can view consultation details and medical records!
    let consultations = [];
    if (req.user.role === 'DOCTOR' || req.user.role === 'SUPER_ADMIN') {
      consultations = await Consultation.find({ patientId: patient._id })
        .populate('doctorId', 'fullName specialty designation')
        .populate('campId', 'name campCode date')
        .populate('prescriptionImageAssetIds')
        .sort({ startedAt: -1 })
        .lean();
    }

    return res.json({
      success: true,
      data: {
        patient,
        visits,
        consultations
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'রোগীর তথ্য আনতে সমস্যা হয়েছে (Failed to fetch patient)',
      error: error.message
    });
  }
}

// Get all registrations / visits in a camp
async function getCampRegistrations(req, res) {
  try {
    const { campId } = req.params;
    const visits = await Visit.find({ campId })
      .populate('patientId')
      .populate('registeredBy', 'name role')
      .sort({ visitToken: 1 })
      .lean();

    return res.json({
      success: true,
      data: visits
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'নিবন্ধিত রোগীদের তালিকা লোড করা যায়নি (Failed to fetch camp registrations)',
      error: error.message
    });
  }
}

module.exports = {
  searchPatients,
  createPatient,
  createCampVisitForPatient,
  getPatientById,
  getCampRegistrations
};
