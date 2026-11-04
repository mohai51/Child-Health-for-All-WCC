const Camp = require('../camps/camp.model');
const Visit = require('../visits/visit.model');
const Consultation = require('../consultations/consultation.model');
const Referral = require('../referrals/referral.model');
const CampMember = require('../camps/campMember.model');
const Doctor = require('../doctors/doctor.model');
const Volunteer = require('../volunteers/volunteer.model');
const User = require('../users/user.model');
const ExcelJS = require('exceljs');
const { stringify } = require('csv-stringify/sync');
const { sanitizeFormulaInjection } = require('../../utils/security');

/**
 * Generate full structured report data for a specific camp
 */
async function getCampReportData(campId) {
  const camp = await Camp.findById(campId);
  if (!camp) {
    throw new Error('ক্যাম্পটি পাওয়া যায়নি (Camp not found)');
  }

  // 1. Camp Members (Doctors & Volunteers)
  const members = await CampMember.find({ campId })
    .populate('doctorId')
    .populate('volunteerId')
    .populate('userId', 'name email role');

  let doctorMembers = members.filter(m => m.campRole === 'DOCTOR' && m.doctorId);

  // Also include doctors who conducted consultations in this camp even if not explicitly in CampMember
  const consultationDocIds = await Consultation.distinct('doctorId', { campId });
  const existingDocMemberIds = new Set(doctorMembers.map(m => m.doctorId._id.toString()));
  for (const docId of consultationDocIds) {
    if (docId && !existingDocMemberIds.has(docId.toString())) {
      const extraDoc = await Doctor.findById(docId);
      if (extraDoc) {
        doctorMembers.push({ doctorId: extraDoc, campRole: 'DOCTOR' });
        existingDocMemberIds.add(docId.toString());
      }
    }
  }

  // Also include doctors who have assignedCampId matching this camp
  const directAssignedDocs = await Doctor.find({ assignedCampId: campId });
  for (const d of directAssignedDocs) {
    if (d && !existingDocMemberIds.has(d._id.toString())) {
      doctorMembers.push({ doctorId: d, campRole: 'DOCTOR' });
      existingDocMemberIds.add(d._id.toString());
    }
  }

  // 2. Aggregate Doctor-wise stats for this camp
  const doctorReport = await Promise.all(
    doctorMembers.map(async m => {
      const doc = m.doctorId;
      const [totalConsultations, totalReferrals, uniquePatientsAgg] = await Promise.all([
        Consultation.countDocuments({ campId, doctorId: doc._id }),
        Referral.countDocuments({ campId, referringDoctorId: doc._id }),
        Consultation.aggregate([
          { $match: { campId: camp._id, doctorId: doc._id } },
          { $group: { _id: '$patientId' } },
          { $count: 'uniquePatients' }
        ])
      ]);

      const uniquePatientsSeen = uniquePatientsAgg[0]?.uniquePatients || 0;

      return {
        doctorId: doc._id,
        doctorName: doc.fullName,
        phone: doc.phone || 'N/A',
        specialty: doc.specialty || '',
        designation: doc.designation || '',
        hospital: doc.hospital || '',
        bmdcNumber: doc.bmdcNumber || '',
        totalConsultations,
        uniquePatientsSeen,
        patientsSeenCount: uniquePatientsSeen || totalConsultations || 0,
        totalReferrals
      };
    })
  );

  // 3. Robust Camp-Wise Volunteer Resolution
  const volunteerMap = new Map();

  const registerVolunteer = (volObj) => {
    if (!volObj) return;
    const key = volObj.volunteerId?.toString() || volObj.email || volObj.phone || volObj.fullName;
    if (!key || volunteerMap.has(key)) return;
    volunteerMap.set(key, volObj);
  };

  // A. CampMember records (both VOLUNTEER and COORDINATOR roles)
  for (const m of members) {
    if (m.campRole === 'VOLUNTEER' || m.campRole === 'COORDINATOR') {
      if (m.volunteerId) {
        const v = m.volunteerId;
        registerVolunteer({
          volunteerId: v._id,
          userId: v.userId || m.userId?._id || null,
          fullName: v.fullName,
          phone: v.phone || 'N/A',
          email: v.email || m.userId?.email || 'N/A',
          responsibility: v.responsibility || (m.campRole === 'COORDINATOR' ? 'Coordination' : 'Registration Desk')
        });
      } else if (m.userId) {
        // Resolve volunteer profile from userId
        const v = await Volunteer.findOne({ userId: m.userId._id || m.userId });
        if (v) {
          registerVolunteer({
            volunteerId: v._id,
            userId: v.userId,
            fullName: v.fullName,
            phone: v.phone || 'N/A',
            email: v.email || m.userId?.email || 'N/A',
            responsibility: v.responsibility || (m.campRole === 'COORDINATOR' ? 'Coordination' : 'Registration Desk')
          });
        } else {
          registerVolunteer({
            volunteerId: m._id,
            userId: m.userId._id || m.userId,
            fullName: m.userId.name || 'স্বেচ্ছাসেবক',
            phone: 'N/A',
            email: m.userId.email || 'N/A',
            responsibility: m.campRole === 'COORDINATOR' ? 'Coordination' : 'Registration Desk'
          });
        }
      }
    }
  }

  // B. Volunteers with assignedCampId === campId
  const directAssignedVols = await Volunteer.find({ assignedCampId: campId }).populate('userId');
  for (const v of directAssignedVols) {
    registerVolunteer({
      volunteerId: v._id,
      userId: v.userId?._id || v.userId || null,
      fullName: v.fullName,
      phone: v.phone || 'N/A',
      email: v.email || v.userId?.email || 'N/A',
      responsibility: v.responsibility || 'Registration Desk'
    });
  }

  // C. Volunteers who registered visits in this camp
  const distinctRegistrars = await Visit.distinct('registeredBy', { campId });
  for (const uId of distinctRegistrars) {
    if (uId) {
      const v = await Volunteer.findOne({ userId: uId }).populate('userId');
      if (v) {
        registerVolunteer({
          volunteerId: v._id,
          userId: v.userId?._id || v.userId || null,
          fullName: v.fullName,
          phone: v.phone || 'N/A',
          email: v.email || v.userId?.email || 'N/A',
          responsibility: v.responsibility || 'Registration Desk'
        });
      } else {
        const u = await User.findById(uId);
        if (u && (u.role === 'REGISTRATION_VOLUNTEER' || u.role === 'CAMP_COORDINATOR')) {
          registerVolunteer({
            volunteerId: u._id,
            userId: u._id,
            fullName: u.name,
            phone: 'N/A',
            email: u.email || 'N/A',
            responsibility: u.role === 'CAMP_COORDINATOR' ? 'Coordination' : 'Registration Desk'
          });
        }
      }
    }
  }

  // Calculate registrations count for each volunteer in this camp
  const volunteerReport = await Promise.all(
    Array.from(volunteerMap.values()).map(async vol => {
      let registrationsCount = 0;
      if (vol.userId) {
        registrationsCount = await Visit.countDocuments({ campId, registeredBy: vol.userId });
      }
      return {
        ...vol,
        registrationsCount
      };
    })
  );

  // 4. Camp Overall Aggregates & Patient Details
  const [totalVisits, totalConsultations, totalReferrals, uniquePatientsAgg] = await Promise.all([
    Visit.countDocuments({ campId }),
    Consultation.countDocuments({ campId }),
    Referral.countDocuments({ campId }),
    Consultation.aggregate([
      { $match: { campId: camp._id } },
      { $group: { _id: '$patientId' } },
      { $count: 'uniquePatients' }
    ])
  ]);

  const uniquePatientsSeen = uniquePatientsAgg[0]?.uniquePatients || 0;

  // 5. Patient Details list for Report 1
  const [consultations, visits, referrals] = await Promise.all([
    Consultation.find({ campId }).populate('patientId').populate('doctorId').sort({ createdAt: 1 }),
    Visit.find({ campId }).populate('patientId').sort({ visitToken: 1 }),
    Referral.find({ campId })
  ]);

  const refByConsultation = {};
  const refByPatient = {};
  referrals.forEach(r => {
    if (r.consultationId) refByConsultation[r.consultationId.toString()] = r;
    if (r.patientId) refByPatient[r.patientId.toString()] = r;
  });

  const consultationByVisitId = {};
  const consultationByPatientId = {};
  consultations.forEach(c => {
    if (c.visitId) consultationByVisitId[c.visitId.toString()] = c;
    if (c.patientId?._id) consultationByPatientId[c.patientId._id.toString()] = c;
  });

  let patientList = [];
  if (visits.length > 0) {
    patientList = visits.map((v, idx) => {
      const p = v.patientId || {};
      const c = consultationByVisitId[v._id.toString()] || consultationByPatientId[p._id?.toString()];
      const ref = c ? (refByConsultation[c._id.toString()] || refByPatient[p._id?.toString()]) : null;
      const isReferred = Boolean(c?.referralRequired || ref);
      const referredTo = ref?.referredHospital || c?.referralNotes || (isReferred ? 'উপজেলা স্বাস্থ্য কমপ্লেক্স / জেলা হাসপাতাল' : '-');

      let ageDisplay = '';
      if (p.ageYears !== undefined && p.ageYears !== null) {
        ageDisplay = `${p.ageYears} বছর`;
        if (p.ageMonths) ageDisplay += ` ${p.ageMonths} মাস`;
      } else {
        ageDisplay = 'N/A';
      }

      const rawBloodGroup = c?.bloodGroup || p.bloodGroup || '';
      const bloodGroup = rawBloodGroup ? rawBloodGroup : '-';

      const rawHb = c?.hemoglobin || p.hemoglobin || '';
      const hemoglobin = rawHb ? (String(rawHb).includes('%') ? rawHb : `${rawHb}%`) : '-';

      const rawBmi = p.bmi || c?.bmi || (p.weight && p.height ? parseFloat((p.weight / Math.pow(p.height / 100, 2)).toFixed(1)) : null);
      const bmi = rawBmi ? `${rawBmi}` : '-';

      return {
        sl: idx + 1,
        patientCode: p.patientId || `T-${v.visitToken}`,
        patientName: p.fullName || 'অজ্ঞাত',
        age: ageDisplay,
        guardianName: p.guardianName || 'N/A',
        phone: p.guardianPhone || 'N/A',
        height: p.height || '-',
        weight: p.weight || '-',
        bmi,
        bloodGroup,
        hemoglobin,
        doctorName: c ? (c.doctorName || c.doctorId?.fullName || 'ডা. কনসালট্যান্ট') : 'অপেক্ষমাণ / দেখা হয়নি',
        isReferred: isReferred ? 'Yes' : 'No',
        referredTo: isReferred ? referredTo : '-'
      };
    });
  } else if (consultations.length > 0) {
    patientList = consultations.map((c, idx) => {
      const p = c.patientId || {};
      const ref = refByConsultation[c._id.toString()] || refByPatient[p._id?.toString()];
      const isReferred = Boolean(c.referralRequired || ref);
      const referredTo = ref?.referredHospital || c.referralNotes || (isReferred ? 'উপজেলা স্বাস্থ্য কমপ্লেক্স / জেলা হাসপাতাল' : '-');

      let ageDisplay = '';
      if (p.ageYears !== undefined && p.ageYears !== null) {
        ageDisplay = `${p.ageYears} বছর`;
        if (p.ageMonths) ageDisplay += ` ${p.ageMonths} মাস`;
      } else {
        ageDisplay = 'N/A';
      }

      const rawBloodGroup = c.bloodGroup || p.bloodGroup || '';
      const bloodGroup = rawBloodGroup ? rawBloodGroup : '-';

      const rawHb = c.hemoglobin || p.hemoglobin || '';
      const hemoglobin = rawHb ? (String(rawHb).includes('%') ? rawHb : `${rawHb}%`) : '-';

      const rawBmi = p.bmi || c.bmi || (p.weight && p.height ? parseFloat((p.weight / Math.pow(p.height / 100, 2)).toFixed(1)) : null);
      const bmi = rawBmi ? `${rawBmi}` : '-';

      return {
        sl: idx + 1,
        patientCode: p.patientId || `P-${idx + 1}`,
        patientName: p.fullName || 'অজ্ঞাত',
        age: ageDisplay,
        guardianName: p.guardianName || 'N/A',
        phone: p.guardianPhone || 'N/A',
        height: p.height || '-',
        weight: p.weight || '-',
        bmi,
        bloodGroup,
        hemoglobin,
        doctorName: c.doctorName || c.doctorId?.fullName || 'ডা. কনসালট্যান্ট',
        isReferred: isReferred ? 'Yes' : 'No',
        referredTo: isReferred ? referredTo : '-'
      };
    });
  }

  // Count total patients seen: unique patients consulted or total consultations
  const totalPatientsSeen = uniquePatientsSeen || consultations.length || 0;

  return {
    camp: {
      id: camp._id,
      name: camp.name,
      campCode: camp.campCode,
      date: camp.date,
      district: camp.district,
      upazila: camp.upazila,
      venue: camp.venue,
      status: camp.status,
      organizerName: camp.organizerName
    },
    summary: {
      totalPatientsSeen, // মোট কতজন রোগী দেখা হয়েছে
      totalVolunteers: volunteerReport.length, // কতজন ভলান্টিয়ার ছিল
      totalDoctors: doctorReport.length, // কতজন ডাক্তার ছিল
      totalRegisteredPatients: totalVisits,
      uniquePatientsSeen,
      totalConsultations,
      totalReferrals
    },
    patients: patientList,
    volunteers: volunteerReport,
    doctors: doctorReport
  };
}

/**
 * Generate CSV buffer with UTF-8 BOM and Formula Injection Sanitization
 */
async function generateCampCsv(campId) {
  const data = await getCampReportData(campId);

  const rows = [
    ['--- উই ক্যান চেঞ্জ (WCC) স্বাস্থ্য ক্যাম্প রিপোর্ট ---'],
    ['ক্যাম্পের নাম', sanitizeFormulaInjection(data.camp.name)],
    ['ক্যাম্প কোড', sanitizeFormulaInjection(data.camp.campCode)],
    ['তারিখ', new Date(data.camp.date).toLocaleDateString('bn-BD')],
    ['স্থান', sanitizeFormulaInjection(`${data.camp.venue}, ${data.camp.upazila}, ${data.camp.district}`)],
    ['অবস্থা', data.camp.status],
    [],
    ['--- সামগ্রিক পরিসংখ্যান (Summary) ---'],
    ['মোট নিবন্ধিত শিশু রোগী', data.summary.totalRegisteredPatients],
    ['চিকিৎসাপ্রাপ্ত অনন্য শিশু রোগী', data.summary.uniquePatientsSeen],
    ['মোট চিকিৎসা পরামর্শ', data.summary.totalConsultations],
    ['মোট রেফারেল', data.summary.totalReferrals],
    ['উপস্থিত চিকিৎসক', data.summary.totalDoctors],
    ['উপস্থিত স্বেচ্ছাসেবক', data.summary.totalVolunteers],
    [],
    ['--- চিকিৎসক ভিত্তিক রিপোর্ট (Doctor-wise Report) ---'],
    ['চিকিৎসকের নাম', 'বিশেষজ্ঞতা', 'পদবি / হাসপাতাল', 'BMDC নম্বর', 'পরামর্শ সংখ্যা', 'অনন্য রোগী', 'রেফারেল সংখ্যা']
  ];

  data.doctors.forEach(doc => {
    rows.push([
      sanitizeFormulaInjection(doc.doctorName),
      sanitizeFormulaInjection(doc.specialty),
      sanitizeFormulaInjection(`${doc.designation} (${doc.hospital || 'N/A'})`),
      sanitizeFormulaInjection(doc.bmdcNumber || 'N/A'),
      doc.totalConsultations,
      doc.uniquePatientsSeen,
      doc.totalReferrals
    ]);
  });

  rows.push([]);
  rows.push(['--- স্বেচ্ছাসেবক ভিত্তিক রিপোর্ট (Volunteer Report) ---']);
  rows.push(['স্বেচ্ছাসেবকের নাম', 'দায়িত্ব', 'মোবাইল নম্বর', 'রোগী নিবন্ধন সংখ্যা']);

  data.volunteers.forEach(vol => {
    rows.push([
      sanitizeFormulaInjection(vol.fullName),
      sanitizeFormulaInjection(vol.responsibility),
      sanitizeFormulaInjection(vol.phone),
      vol.registrationsCount
    ]);
  });

  // UTF-8 BOM ensures Excel natively opens Bangla text correctly
  const csvContent = '\uFEFF' + stringify(rows);
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Generate Excel (XLSX) buffer
 */
async function generateCampXlsx(campId) {
  const data = await getCampReportData(campId);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'We Can Change (WCC)';
  workbook.created = new Date();

  // 1. Summary Sheet
  const summarySheet = workbook.addWorksheet('ক্যাম্প সারাংশ');
  summarySheet.columns = [
    { header: 'বিবরণ', key: 'metric', width: 35 },
    { header: 'মান', key: 'value', width: 45 }
  ];

  summarySheet.addRow({ metric: 'ক্যাম্পের নাম', value: sanitizeFormulaInjection(data.camp.name) });
  summarySheet.addRow({ metric: 'ক্যাম্প কোড', value: sanitizeFormulaInjection(data.camp.campCode) });
  summarySheet.addRow({ metric: 'তারিখ', value: new Date(data.camp.date).toLocaleDateString() });
  summarySheet.addRow({ metric: 'ভেন্যু ও এলাকা', value: sanitizeFormulaInjection(`${data.camp.venue}, ${data.camp.upazila}, ${data.camp.district}`) });
  summarySheet.addRow({ metric: 'ক্যাম্প স্ট্যাটাস', value: data.camp.status });
  summarySheet.addRow({ metric: 'মোট নিবন্ধিত রোগী', value: data.summary.totalRegisteredPatients });
  summarySheet.addRow({ metric: 'চিকিৎসাপ্রাপ্ত অনন্য শিশু রোগী', value: data.summary.uniquePatientsSeen });
  summarySheet.addRow({ metric: 'মোট পরামর্শ', value: data.summary.totalConsultations });
  summarySheet.addRow({ metric: 'মোট রেফারেল', value: data.summary.totalReferrals });
  summarySheet.addRow({ metric: 'অংশগ্রহণকারী চিকিৎসক', value: data.summary.totalDoctors });
  summarySheet.addRow({ metric: 'অংশগ্রহণকারী স্বেচ্ছাসেবক', value: data.summary.totalVolunteers });

  // 2. Doctors Sheet
  const docSheet = workbook.addWorksheet('চিকিৎসক রিপোর্ট');
  docSheet.columns = [
    { header: 'চিকিৎসকের নাম', key: 'name', width: 30 },
    { header: 'বিশেষজ্ঞতা', key: 'specialty', width: 25 },
    { header: 'পদবি ও হাসপাতাল', key: 'designation', width: 35 },
    { header: 'BMDC নম্বর', key: 'bmdc', width: 20 },
    { header: 'পরামর্শ সংখ্যা', key: 'consultations', width: 18 },
    { header: 'অনন্য রোগী', key: 'unique', width: 18 },
    { header: 'রেফারেল', key: 'referrals', width: 15 }
  ];

  data.doctors.forEach(doc => {
    docSheet.addRow({
      name: sanitizeFormulaInjection(doc.doctorName),
      specialty: sanitizeFormulaInjection(doc.specialty),
      designation: sanitizeFormulaInjection(`${doc.designation} (${doc.hospital || 'N/A'})`),
      bmdc: sanitizeFormulaInjection(doc.bmdcNumber || 'N/A'),
      consultations: doc.totalConsultations,
      unique: doc.uniquePatientsSeen,
      referrals: doc.totalReferrals
    });
  });

  // 3. Volunteers Sheet
  const volSheet = workbook.addWorksheet('স্বেচ্ছাসেবক রিপোর্ট');
  volSheet.columns = [
    { header: 'নাম', key: 'name', width: 30 },
    { header: 'দায়িত্ব', key: 'resp', width: 25 },
    { header: 'ফোন নম্বর', key: 'phone', width: 20 },
    { header: 'নিবন্ধন সংখ্যা', key: 'count', width: 18 }
  ];

  data.volunteers.forEach(vol => {
    volSheet.addRow({
      name: sanitizeFormulaInjection(vol.fullName),
      resp: sanitizeFormulaInjection(vol.responsibility),
      phone: sanitizeFormulaInjection(vol.phone),
      count: vol.registrationsCount
    });
  });

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  getCampReportData,
  generateCampCsv,
  generateCampXlsx
};
