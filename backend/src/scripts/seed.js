const { cleanAndSeedDatabase } = require('./cleanDatabase');
const User = require('../modules/users/user.model');
const { hashPassword } = require('../utils/security');
const logger = require('../config/logger');

async function ensureSuperAdminAccount() {
  try {
    const existing = await User.findOne({ email: 'admin@wcc.org.bd' });
    if (!existing) {
      const passwordHash = await hashPassword('Admin@123');
      await User.create({
        name: 'সুপার অ্যাডমিন (Super Admin)',
        email: 'admin@wcc.org.bd',
        passwordHash,
        role: 'SUPER_ADMIN',
        accountStatus: 'ACTIVE'
      });
      logger.info('Official Super Admin account created: admin@wcc.org.bd');
    } else {
      if (existing.role !== 'SUPER_ADMIN' || existing.accountStatus !== 'ACTIVE') {
        existing.role = 'SUPER_ADMIN';
        existing.accountStatus = 'ACTIVE';
        await existing.save();
      }
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not ensure Super Admin account');
  }
}

async function ensureMeasurementOfficerAccount() {
  try {
    const existing = await User.findOne({ email: 'm@wcc.org.bd' });
    if (!existing) {
      const passwordHash = await hashPassword('Measure@123');
      await User.create({
        name: 'পরিমাপ কর্মকর্তা (Measurement Officer)',
        email: 'm@wcc.org.bd',
        passwordHash,
        role: 'MEASUREMENT_OFFICER',
        accountStatus: 'ACTIVE'
      });
      logger.info('Official Measurement Officer account created: m@wcc.org.bd');
    } else {
      if (existing.role !== 'MEASUREMENT_OFFICER' || existing.accountStatus !== 'ACTIVE') {
        existing.role = 'MEASUREMENT_OFFICER';
        existing.accountStatus = 'ACTIVE';
        await existing.save();
      }
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not ensure Measurement Officer account');
  }
}

async function ensureDoctorAccount() {
  try {
    const existing = await User.findOne({ email: 'doctor@wcc.org.bd' });
    if (!existing) {
      const Doctor = require('../modules/doctors/doctor.model');
      const Camp = require('../modules/camps/camp.model');
      const CampMember = require('../modules/camps/campMember.model');
      const activeCamp = await Camp.findOne({ status: 'ACTIVE' });
      const passwordHash = await hashPassword('Doctor@123');
      const user = await User.create({
        name: 'ডা. ফারহানা হক (Dr. Farhana Huq)',
        email: 'doctor@wcc.org.bd',
        passwordHash,
        role: 'DOCTOR',
        accountStatus: 'ACTIVE'
      });
      const doctorProfile = await Doctor.create({
        userId: user._id,
        fullName: 'ডা. ফারহানা হক (Dr. Farhana Huq)',
        specialty: 'নবজাতক ও শিশু বিশেষজ্ঞ (Newborn & Child Specialist)',
        designation: 'কনসালট্যান্ট',
        hospital: 'ঢাকা শিশু হাসপাতাল',
        bmdcNumber: 'A-48291',
        phone: '01711000001',
        assignedCampId: activeCamp ? activeCamp._id : null,
        accountStatus: 'ACTIVE'
      });
      if (activeCamp) {
        await CampMember.create({
          campId: activeCamp._id,
          userId: user._id,
          doctorId: doctorProfile._id,
          campRole: 'DOCTOR'
        });
      }
      logger.info('Official Doctor account created: doctor@wcc.org.bd');
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not ensure Doctor account');
  }
}

async function ensureVolunteerAccount() {
  try {
    const existing = await User.findOne({ email: 'volunteer@wcc.org.bd' });
    if (!existing) {
      const Volunteer = require('../modules/volunteers/volunteer.model');
      const Camp = require('../modules/camps/camp.model');
      const CampMember = require('../modules/camps/campMember.model');
      const activeCamp = await Camp.findOne({ status: 'ACTIVE' });
      const passwordHash = await hashPassword('Volunteer@123');
      const user = await User.create({
        name: 'সাদিয়া সুলতানা (Sadia Sultana)',
        email: 'volunteer@wcc.org.bd',
        passwordHash,
        role: 'REGISTRATION_VOLUNTEER',
        accountStatus: 'ACTIVE'
      });
      const volProfile = await Volunteer.create({
        userId: user._id,
        fullName: 'সাদিয়া সুলতানা (Sadia Sultana)',
        email: 'volunteer@wcc.org.bd',
        phone: '01811000001',
        responsibility: 'Registration Desk',
        assignedCampId: activeCamp ? activeCamp._id : null,
        accountStatus: 'ACTIVE'
      });
      if (activeCamp) {
        await CampMember.create({
          campId: activeCamp._id,
          userId: user._id,
          volunteerId: volProfile._id,
          campRole: 'VOLUNTEER'
        });
      }
      logger.info('Official Volunteer account created: volunteer@wcc.org.bd');
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not ensure Volunteer account');
  }
}

async function seedInitialData() {
  try {
    const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });
    if (adminExists) {
      logger.info('Database already contains records. Skipping initial seeding.');
      await ensureSuperAdminAccount();
      await ensureMeasurementOfficerAccount();
      await ensureDoctorAccount();
      await ensureVolunteerAccount();
      return;
    }

    logger.info('Database is empty. Seeding official accounts...');
    await cleanAndSeedDatabase();
    await ensureMeasurementOfficerAccount();
    await ensureDoctorAccount();
    await ensureVolunteerAccount();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed during initial data seeding');
  }
}

if (require.main === module) {
  seedInitialData();
}

module.exports = { seedInitialData };
