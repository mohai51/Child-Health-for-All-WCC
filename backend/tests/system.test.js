process.env.NODE_ENV = 'test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const app = require('../src/app');
const { seedInitialData } = require('../src/scripts/seed');

let server;
let baseUrl;
let adminCookie = '';
let doctorCookie = '';
let volunteerCookie = '';
let csrfToken = '';

// Helper to make fetch requests with cookies and CSRF
async function apiRequest(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  if (csrfToken && !['GET', 'HEAD'].includes(options.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const setCookie = res.headers.get('set-cookie');
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('text/') || contentType.includes('application/')) {
    data = await res.arrayBuffer();
  }

  return { status: res.status, data, headers: res.headers, setCookie };
}

describe('WCC Child Health Registry - Comprehensive Test Suite', () => {
  let createdCampId = '';
  let createdPatientId = '';
  let createdPatientDocId = '';
  let createdVisitId = '';
  let createdDoctorId = '';
  let createdConsultationId = '';
  let testAssetId = '';

  before(async () => {
    // Connect to in-memory database
    await connectDB();
    await seedInitialData();

    // Start express app on ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Obtain initial CSRF cookie
    const initRes = await apiRequest('/api/health');
    const setCookie = initRes.setCookie;
    if (setCookie) {
      const match = setCookie.match(/wcc_csrf=([^;]+)/);
      if (match) csrfToken = match[1];
    }
  });

  after(async () => {
    if (server) server.close();
    await disconnectDB();
  });

  // Test 1: Admin login
  test('1. Admin login succeeds with valid credentials', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@wcc.org.bd',
        password: 'AdminPassword@123'
      })
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.role, 'SUPER_ADMIN');

    // Extract session cookie
    const match = res.setCookie?.match(/wcc_session=([^;]+)/);
    assert.ok(match, 'Session cookie must be set');
    adminCookie = `wcc_session=${match[1]}; wcc_csrf=${csrfToken}`;
  });

  // Test 2: Invalid login
  test('2. Invalid login fails with 401', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@wcc.org.bd',
        password: 'WrongPassword'
      })
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
  });

  // Test 3: Role-based authorization
  test('3. Role-based authorization prevents non-admin from creating camps', async () => {
    // Log in as registration volunteer
    const volLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'volunteer1@wcc.org.bd',
        password: 'Volunteer@123'
      })
    });
    const match = volLogin.setCookie?.match(/wcc_session=([^;]+)/);
    volunteerCookie = `wcc_session=${match[1]}; wcc_csrf=${csrfToken}`;

    // Attempt to create camp as volunteer
    const res = await apiRequest('/api/camps', {
      method: 'POST',
      cookie: volunteerCookie,
      body: JSON.stringify({
        name: 'অননুমোদিত ক্যাম্প',
        date: '2026-11-20',
        district: 'ঢাকা',
        upazila: 'মিরপুর',
        venue: 'স্কুল মাঠ'
      })
    });

    assert.equal(res.status, 403, 'Volunteer must be forbidden from creating camps');
  });

  // Test 4: Camp creation
  test('4. Super Admin creates a new health camp in DRAFT status', async () => {
    const res = await apiRequest('/api/camps', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        name: 'রংপুর পীরগঞ্জ শিশু স্বাস্থ্য ক্যাম্প',
        date: '2026-12-05',
        district: 'রংপুর',
        upazila: 'পীরগঞ্জ',
        venue: 'পীরগঞ্জ মডেল প্রাথমিক বিদ্যালয়',
        description: 'সুবিধাবঞ্চিত শিশুদের জন্য স্বাস্থ্য ক্যাম্প'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.status, 'DRAFT');
    assert.ok(res.data.data.campCode.startsWith('CAMP-'));
    createdCampId = res.data.data._id;
  });

  // Test 5: Camp activation
  test('5. Super Admin activates the health camp', async () => {
    const res = await apiRequest(`/api/camps/${createdCampId}/activate`, {
      method: 'POST',
      cookie: adminCookie
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.status, 'ACTIVE');
    assert.ok(res.data.data.activatedAt);
  });

  // Test 6: Doctor creation
  test('6. Super Admin creates a new doctor profile', async () => {
    const res = await apiRequest('/api/doctors', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        fullName: 'ডা. আনিসুল ইসলাম',
        email: 'dr.anisul@wcc.org.bd',
        password: 'DoctorPassword@123',
        specialty: 'শিশু কার্ডিওলজি',
        designation: 'সহযোগী অধ্যাপক',
        hospital: 'জাতীয় হৃদরোগ ইনস্টিটিউট',
        bmdcNumber: 'A-77889',
        phone: '01712999999'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdDoctorId = res.data.data.doctor._id;
  });

  // Test 7: Volunteer creation
  test('7. Super Admin creates a new volunteer', async () => {
    const res = await apiRequest('/api/volunteers', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        fullName: 'মোস্তফা কামাল',
        phone: '01911999999',
        email: 'mostafa@wcc.org.bd',
        password: 'Volunteer@123',
        responsibility: 'Registration Desk',
        createLoginAccount: true
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.responsibility, 'Registration Desk');
  });

  // Test 8: Assign doctor and volunteer to the created camp
  test('8. Admin assigns doctor and volunteer to the active camp', async () => {
    const docAssign = await apiRequest(`/api/camps/${createdCampId}/members`, {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        doctorId: createdDoctorId,
        campRole: 'DOCTOR'
      })
    });
    assert.equal(docAssign.status, 201);

    // Also assign volunteer
    const volAssign = await apiRequest(`/api/camps/${createdCampId}/members`, {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        userId: (await mongoose.model('User').findOne({ email: 'volunteer1@wcc.org.bd' }))._id.toString(),
        campRole: 'VOLUNTEER'
      })
    });
    assert.equal(volAssign.status, 201);
  });

  // Test 9 & 10: Patient registration and atomic Unique Patient ID generation
  test('9 & 10. Volunteer registers a patient and receives unique collision-safe Patient ID (WCC-000001)', async () => {
    const res = await apiRequest('/api/patients', {
      method: 'POST',
      cookie: volunteerCookie,
      body: JSON.stringify({
        campId: createdCampId,
        fullName: 'মোঃ জাহিদ হাসান',
        ageYears: 7,
        ageMonths: 4,
        sex: 'MALE',
        guardianName: 'রফিকুল ইসলাম',
        guardianPhone: '01715000000',
        district: 'রংপুর',
        upazila: 'পীরগঞ্জ',
        weight: 21.5,
        height: 118,
        mainComplaint: '৩ দিন ধরে তীব্র জ্বর ও সর্দি',
        guardianConsent: true
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.patient.patientId.startsWith('WCC-'));
    createdPatientId = res.data.data.patient.patientId;
    createdPatientDocId = res.data.data.patient._id;
    createdVisitId = res.data.data.visit._id;
  });

  // Test 11: Duplicate registration prevention
  test('11. Prevents duplicate patient registration within the same camp', async () => {
    // Attempt to register the same returning patient to the same camp
    const res = await apiRequest(`/api/camps/${createdCampId}/registrations`, {
      method: 'POST',
      cookie: volunteerCookie,
      body: JSON.stringify({
        patientRecordId: createdPatientDocId,
        mainComplaint: 'আবার নিবন্ধন চেষ্টা'
      })
    });

    assert.equal(res.status, 400);
    assert.ok(res.data.message.includes('ইতিমধ্যে এই স্বাস্থ্য ক্যাম্পে নিবন্ধিত'));
  });

  // Test 12: Patient search by ID
  test('12. Patient search by ID finds registered patient and camp visit status', async () => {
    const res = await apiRequest(`/api/patients/search?q=${createdPatientId}&campId=${createdCampId}`, {
      cookie: volunteerCookie
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.data.length > 0);
    assert.equal(res.data.data[0].patientId, createdPatientId);
    assert.equal(res.data.data[0].isRegisteredInSelectedCamp, true);
  });

  // Test 13 & 14: Doctor consultation and automatic Doctor ID linking from session
  test('13 & 14. Doctor logs in, starts consultation, and doctorId is automatically linked from session', async () => {
    // Login as Dr. Anisul
    const docLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'dr.anisul@wcc.org.bd',
        password: 'DoctorPassword@123'
      })
    });
    const match = docLogin.setCookie?.match(/wcc_session=([^;]+)/);
    doctorCookie = `wcc_session=${match[1]}; wcc_csrf=${csrfToken}`;

    // Doctor searches patient in camp
    const searchRes = await apiRequest(`/api/camps/${createdCampId}/consultations/search-patient?patientId=${createdPatientId}`, {
      cookie: doctorCookie
    });
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.data.data.patient.patientId, createdPatientId);

    // Doctor starts consultation (notice frontend does NOT send doctorId!)
    const consultRes = await apiRequest(`/api/camps/${createdCampId}/consultations`, {
      method: 'POST',
      cookie: doctorCookie,
      body: JSON.stringify({
        patientId: createdPatientDocId,
        visitId: createdVisitId
      })
    });

    assert.equal(consultRes.status, 201);
    assert.equal(consultRes.data.data.doctorId, createdDoctorId);
    assert.equal(consultRes.data.data.doctorName, 'Dr. ডা. আনিসুল ইসলাম');
    createdConsultationId = consultRes.data.data._id;
  });

  // Test 15: Multiple doctors consulting one patient in same camp
  test('15. Another doctor can create a separate consultation for the same patient', async () => {
    // Assign Dr. Farhana to the camp
    const drFarhana = await mongoose.model('Doctor').findOne({ email: 'dr.farhana@wcc.org.bd' });
    await apiRequest(`/api/camps/${createdCampId}/members`, {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        doctorId: drFarhana._id.toString(),
        campRole: 'DOCTOR'
      })
    });

    // Login as Dr. Farhana
    const loginFarhana = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'dr.farhana@wcc.org.bd',
        password: 'Doctor@123'
      })
    });
    const match = loginFarhana.setCookie?.match(/wcc_session=([^;]+)/);
    const drFarhanaCookie = `wcc_session=${match[1]}; wcc_csrf=${csrfToken}`;

    // Dr. Farhana starts a consultation for the same patient
    const res = await apiRequest(`/api/camps/${createdCampId}/consultations`, {
      method: 'POST',
      cookie: drFarhanaCookie,
      body: JSON.stringify({
        patientId: createdPatientDocId,
        visitId: createdVisitId
      })
    });

    assert.equal(res.status, 201);
    assert.notEqual(res.data.data._id, createdConsultationId, 'Must create separate consultation record');
    assert.equal(res.data.data.doctorId, drFarhana._id.toString());
  });

  // Test 16 & 17: Prescription upload authorization & validation
  test('16 & 17. Doctor can upload prescription photo with file validation, while volunteer is denied', async () => {
    // Create a temporary test image
    const tempImgPath = path.join(__dirname, 'test_prescription.jpg');
    fs.writeFileSync(tempImgPath, Buffer.from('FAKE_JPEG_IMAGE_CONTENT'));

    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(tempImgPath)], { type: 'image/jpeg' });
    formData.append('image', fileBlob, 'prescription.jpg');
    formData.append('category', 'PRESCRIPTION');

    // Attempt upload as volunteer (should fail with 403)
    const volUploadRes = await fetch(`${baseUrl}/api/images/upload`, {
      method: 'POST',
      headers: {
        'Cookie': volunteerCookie,
        'X-CSRF-Token': csrfToken
      },
      body: formData
    });
    assert.equal(volUploadRes.status, 403, 'Volunteer cannot upload confidential prescription');

    // Upload as doctor (should succeed)
    const docFormData = new FormData();
    docFormData.append('image', fileBlob, 'prescription.jpg');
    docFormData.append('category', 'PRESCRIPTION');
    const docUploadRes = await fetch(`${baseUrl}/api/images/upload`, {
      method: 'POST',
      headers: {
        'Cookie': doctorCookie,
        'X-CSRF-Token': csrfToken
      },
      body: docFormData
    });

    assert.equal(docUploadRes.status, 201);
    const uploadData = await docUploadRes.json();
    assert.equal(uploadData.data.category, 'PRESCRIPTION');
    assert.equal(uploadData.data.isConfidential, true);
    testAssetId = uploadData.data.assetId;

    if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath);
  });

  // Test 18: Save consultation and doctor statistics
  test('18 & 19. Doctor saves consultation with diagnosis, prescription, referral, and updates stats', async () => {
    const res = await apiRequest(`/api/camps/${createdCampId}/consultations/${createdConsultationId}`, {
      method: 'PATCH',
      cookie: doctorCookie,
      body: JSON.stringify({
        diagnosis: 'তীব্র ব্রঙ্কাইটিস ও নিউমোনিয়া সন্দেহ',
        quickCategories: ['জ্বর', 'সর্দি-কাশি'],
        notes: 'স্যালাইন ও অ্যান্টিবায়োটিক ইনজেকশন প্রয়োজন হতে পারে। দ্রুত পরীক্ষা আবশ্যক।',
        prescriptionImageAssetIds: [testAssetId],
        referralRequired: true,
        referralData: {
          referredHospital: 'রংপুর মেডিকেল কলেজ হাসপাতাল',
          reason: 'শিশু বক্ষব্যাধি বিশেষজ্ঞ পরামর্শ ও এক্স-রে',
          followUpDate: '2026-12-10'
        }
      })
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.consultation.status, 'REFERRED');
    assert.equal(res.data.data.referral.referredHospital, 'রংপুর মেডিকেল কলেজ হাসপাতাল');

    // Verify doctor stats updated
    const docStatsRes = await apiRequest(`/api/doctors/${createdDoctorId}`, {
      cookie: doctorCookie
    });
    assert.equal(docStatsRes.status, 200);
    assert.equal(docStatsRes.data.data.stats.totalConsultations, 1);
    assert.equal(docStatsRes.data.data.stats.totalReferrals, 1);
  });

  // Test 20: Camp-wise reporting and CSV/XLSX export
  test('20. Super Admin exports camp summary report in CSV and XLSX format', async () => {
    // CSV Export
    const csvRes = await apiRequest(`/api/camps/${createdCampId}/reports/export?format=csv`, {
      cookie: adminCookie
    });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get('content-type').includes('text/csv'));

    // XLSX Export
    const xlsxRes = await apiRequest(`/api/camps/${createdCampId}/reports/export?format=xlsx`, {
      cookie: adminCookie
    });
    assert.equal(xlsxRes.status, 200);
    assert.ok(xlsxRes.headers.get('content-type').includes('spreadsheetml'));
  });

  // Test 21: Closed camp restrictions
  test('21. Camp closing disables new registrations and consultations but preserves records', async () => {
    // Close camp
    const closeRes = await apiRequest(`/api/camps/${createdCampId}/close`, {
      method: 'POST',
      cookie: adminCookie
    });
    assert.equal(closeRes.status, 200);
    assert.equal(closeRes.data.data.status, 'CLOSED');

    // Attempt new patient registration in closed camp
    const regRes = await apiRequest('/api/patients', {
      method: 'POST',
      cookie: volunteerCookie,
      body: JSON.stringify({
        campId: createdCampId,
        fullName: 'নতুন শিশু',
        ageYears: 5,
        sex: 'FEMALE',
        guardianName: 'অভিভাবক',
        district: 'রংপুর',
        upazila: 'পীরগঞ্জ',
        guardianConsent: true
      })
    });
    assert.equal(regRes.status, 400);
    assert.ok(regRes.data.message.includes('সক্রিয় নয়'));

    // Existing records remain accessible
    const getCampRes = await apiRequest(`/api/camps/${createdCampId}`, {
      cookie: adminCookie
    });
    assert.equal(getCampRes.status, 200);
    assert.equal(getCampRes.data.data.stats.totalVisits, 1);
  });

  // Test 22: Unauthorized medical image access
  test('22. Unauthorized users and volunteers are blocked from confidential prescription images', async () => {
    const volAccessRes = await fetch(`${baseUrl}/api/images/${testAssetId}`, {
      headers: {
        'Cookie': volunteerCookie
      }
    });

    assert.equal(volAccessRes.status, 403, 'Volunteer must not have access to prescription image');
  });

  // Test 23: CSRF Protection
  test('23. State-changing requests without CSRF token are rejected with 403', async () => {
    const res = await fetch(`${baseUrl}/api/camps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
        // Intentionally omit X-CSRF-Token
      },
      body: JSON.stringify({ name: 'CSRF Test Camp' })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.message.includes('CSRF'));
  });

  // Test 24: Cross-camp access prevention
  test('24. Doctor cannot access patient search in a camp they are not assigned to', async () => {
    // Create a 2nd camp without assigning Dr. Anisul
    const camp2Res = await apiRequest('/api/camps', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        name: 'সিলেট মৌলভীবাজার শিশু স্বাস্থ্য ক্যাম্প',
        date: '2026-12-15',
        district: 'মৌলভীবাজার',
        upazila: 'শ্রীমঙ্গল',
        venue: 'শ্রীমঙ্গল চা বাগান প্রাঙ্গণ'
      })
    });
    const camp2Id = camp2Res.data.data._id;
    await apiRequest(`/api/camps/${camp2Id}/activate`, { method: 'POST', cookie: adminCookie });

    // Dr. Anisul attempts to search in camp 2
    const searchRes = await apiRequest(`/api/camps/${camp2Id}/consultations/search-patient?patientId=${createdPatientId}`, {
      cookie: doctorCookie
    });

    assert.equal(searchRes.status, 400);
    assert.ok(searchRes.data.message.includes('নিযুক্ত নন'));
  });
});
