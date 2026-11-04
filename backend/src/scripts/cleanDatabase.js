const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../modules/users/user.model');
const Doctor = require('../modules/doctors/doctor.model');
const Volunteer = require('../modules/volunteers/volunteer.model');
const Camp = require('../modules/camps/camp.model');
const CampMember = require('../modules/camps/campMember.model');
const Patient = require('../modules/patients/patient.model');
const Visit = require('../modules/visits/visit.model');
const Consultation = require('../modules/consultations/consultation.model');
const Referral = require('../modules/referrals/referral.model');
const AuditLog = require('../utils/auditLog.model');
const ImageAsset = require('../modules/images/imageAsset.model');
const Counter = require('../modules/patients/counter.model');
const { hashPassword } = require('../utils/security');
const logger = require('../config/logger');

async function cleanAndSeedDatabase() {
  try {
    logger.info('Connecting to database...');
    await connectDB();

    logger.info('Clearing all existing data from database collections...');
    await Promise.all([
      User.deleteMany({}),
      Doctor.deleteMany({}),
      Volunteer.deleteMany({}),
      Camp.deleteMany({}),
      CampMember.deleteMany({}),
      Patient.deleteMany({}),
      Visit.deleteMany({}),
      Consultation.deleteMany({}),
      Referral.deleteMany({}),
      AuditLog.deleteMany({}),
      ImageAsset.deleteMany({}),
      Counter.deleteMany({})
    ]);
    logger.info('All collections cleared successfully.');

    // 1. Create Super Admin User
    const adminPasswordHash = await hashPassword('AdminPassword@123');
    const superAdmin = await User.create({
      name: 'সুপার অ্যাডমিন (Super Admin)',
      email: 'admin@wcc.org.bd',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      accountStatus: 'ACTIVE'
    });
    logger.info('Created Super Admin: admin@wcc.org.bd');

    // 2. Create Active Camp
    const currentYear = new Date().getFullYear();
    const activeCamp = await Camp.create({
      campCode: `CAMP-${currentYear}-001`,
      name: 'ঢাকা শিশু স্বাস্থ্য ক্যাম্প ১',
      date: new Date(),
      district: 'ঢাকা',
      upazila: 'ডেমরা',
      venue: 'মাতুয়াইল শিশু মাতৃ স্বাস্থ্য ইনস্টিটিউট, ঢাকা',
      isPourashava: false,
      pourashavaName: '',
      description: 'উই ক্যান চেঞ্জ (WCC) শিশু স্বাস্থ্য সেবা ও পুষ্টি ক্যাম্প ২০২৬',
      organizerName: 'We Can Change (WCC)',
      status: 'ACTIVE',
      createdBy: superAdmin._id
    });
    logger.info(`Created Active Camp: ${activeCamp.name} (${activeCamp.campCode})`);

    // 3. Create Doctor User & Linked Profile
    const doctorPasswordHash = await hashPassword('Doctor@123');
    const doctorUser = await User.create({
      name: 'ডা. ফারহানা হক (Dr. Farhana Huq)',
      email: 'doctor@wcc.org.bd',
      passwordHash: doctorPasswordHash,
      role: 'DOCTOR',
      accountStatus: 'ACTIVE'
    });

    const doctorProfile = await Doctor.create({
      userId: doctorUser._id,
      fullName: 'ডা. ফারহানা হক (Dr. Farhana Huq)',
      specialty: 'নবজাতক ও শিশু বিশেষজ্ঞ (Newborn & Child Specialist)',
      designation: 'কনসালট্যান্ট',
      hospital: 'ঢাকা শিশু হাসপাতাল',
      bmdcNumber: 'A-48291',
      phone: '01711000001',
      assignedCampId: activeCamp._id,
      accountStatus: 'ACTIVE'
    });

    await CampMember.create({
      campId: activeCamp._id,
      userId: doctorUser._id,
      doctorId: doctorProfile._id,
      campRole: 'DOCTOR'
    });
    logger.info('Created Doctor: doctor@wcc.org.bd');

    // 4. Create Volunteer User & Linked Profile
    const volunteerPasswordHash = await hashPassword('Volunteer@123');
    const volunteerUser = await User.create({
      name: 'সাদিয়া সুলতানা (Sadia Sultana)',
      email: 'volunteer@wcc.org.bd',
      passwordHash: volunteerPasswordHash,
      role: 'REGISTRATION_VOLUNTEER',
      accountStatus: 'ACTIVE'
    });

    const volunteerProfile = await Volunteer.create({
      userId: volunteerUser._id,
      fullName: 'সাদিয়া সুলতানা (Sadia Sultana)',
      email: 'volunteer@wcc.org.bd',
      phone: '01811000001',
      responsibility: 'Registration Desk',
      assignedCampId: activeCamp._id,
      accountStatus: 'ACTIVE'
    });

    await CampMember.create({
      campId: activeCamp._id,
      userId: volunteerUser._id,
      volunteerId: volunteerProfile._id,
      campRole: 'VOLUNTEER'
    });
    logger.info('Created Volunteer: volunteer@wcc.org.bd');

    // 5. Create Measurement Officer
    const measurePasswordHash = await hashPassword('Measure@123');
    await User.create({
      name: 'পরিমাপ কর্মকর্তা (Measurement Officer)',
      email: 'm@wcc.org.bd',
      passwordHash: measurePasswordHash,
      role: 'MEASUREMENT_OFFICER',
      accountStatus: 'ACTIVE'
    });
    logger.info('Created Measurement Officer: m@wcc.org.bd');

    // 6. Reset patient ID sequence counter
    await Counter.create({
      _id: 'patientId',
      seq: 0
    });
    logger.info('Patient ID counter reset to 0 (First patient will be WCC-000001)');

    console.log('\n======================================================');
    console.log('✅ DATABASE CLEANED AND OFFICIAL ACCOUNTS READY:');
    console.log('------------------------------------------------------');
    console.log('1. SUPER ADMIN:');
    console.log('   Email:    admin@wcc.org.bd');
    console.log('   Password: AdminPassword@123');
    console.log('------------------------------------------------------');
    console.log('2. DOCTOR:');
    console.log('   Email:    doctor@wcc.org.bd');
    console.log('   Password: Doctor@123');
    console.log('------------------------------------------------------');
    console.log('3. MEASUREMENT CORNER:');
    console.log('   Email:    m@wcc.org.bd');
    console.log('   Password: Measure@123');
    console.log('------------------------------------------------------');
    console.log('4. VOLUNTEER (REGISTRATION):');
    console.log('   Email:    volunteer@wcc.org.bd');
    console.log('   Password: Volunteer@123');
    console.log('======================================================\n');

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to clean and seed database');
    console.error('Error cleaning database:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

if (require.main === module) {
  cleanAndSeedDatabase();
}

module.exports = { cleanAndSeedDatabase };
