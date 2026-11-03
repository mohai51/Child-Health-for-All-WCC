const User = require('../modules/users/user.model');
const Doctor = require('../modules/doctors/doctor.model');
const Volunteer = require('../modules/volunteers/volunteer.model');
const Camp = require('../modules/camps/camp.model');
const CampMember = require('../modules/camps/campMember.model');
const Counter = require('../modules/patients/counter.model');
const { hashPassword } = require('../utils/security');
const logger = require('../config/logger');

async function seedInitialData() {
  try {
    const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });
    if (adminExists) {
      logger.info('Database already contains records. Skipping initial seeding.');
      return;
    }

    logger.info('Seeding initial system users, doctors, volunteers, and camp data...');

    // 1. Super Admin
    const adminPasswordHash = await hashPassword('AdminPassword@123');
    const superAdmin = await User.create({
      name: 'সুপার অ্যাডমিন (WCC)',
      email: 'admin@wcc.org.bd',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      accountStatus: 'ACTIVE'
    });

    // 2. Doctors (4 doctors)
    const doctorPasswordHash = await hashPassword('Doctor@123');
    const doctorsData = [
      {
        fullName: 'ডা. ফারহানা রহমান (Dr. Farhana Rahman)',
        email: 'dr.farhana@wcc.org.bd',
        specialty: 'শিশু বিশেষজ্ঞ (Pediatrics)',
        designation: 'কনসালট্যান্ট',
        hospital: 'ঢাকা শিশু হাসপাতাল',
        bmdcNumber: 'A-48291',
        phone: '01711000001'
      },
      {
        fullName: 'ডা. মাহমুদুল হাসান (Dr. Mahmudul Hasan)',
        email: 'dr.mahmud@wcc.org.bd',
        specialty: 'সহকারী অধ্যাপক, শিশু বিভাগ',
        designation: 'সহকারী অধ্যাপক',
        hospital: 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
        bmdcNumber: 'A-39210',
        phone: '01711000002'
      },
      {
        fullName: 'ডা. নুসরাত জাহান (Dr. Nusrat Jahan)',
        email: 'dr.nusrat@wcc.org.bd',
        specialty: 'মেডিকেল অফিসার, মা ও শিশু স্বাস্থ্য',
        designation: 'মেডিকেল অফিসার',
        hospital: 'মাতুয়াইল শিশু মাতৃ স্বাস্থ্য ইনস্টিটিউট',
        bmdcNumber: 'A-61203',
        phone: '01711000003'
      },
      {
        fullName: 'ডা. তানভীর আহমেদ (Dr. Tanvir Ahmed)',
        email: 'dr.tanvir@wcc.org.bd',
        specialty: 'শিশু সার্জন (Pediatric Surgery)',
        designation: 'রেজিস্ট্রার',
        hospital: 'বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয় (BSMMU)',
        bmdcNumber: 'A-52194',
        phone: '01711000004'
      }
    ];

    const createdDoctors = [];
    for (const d of doctorsData) {
      const user = await User.create({
        name: d.fullName,
        email: d.email,
        passwordHash: doctorPasswordHash,
        role: 'DOCTOR',
        accountStatus: 'ACTIVE'
      });

      const doctor = await Doctor.create({
        userId: user._id,
        fullName: d.fullName,
        specialty: d.specialty,
        designation: d.designation,
        hospital: d.hospital,
        bmdcNumber: d.bmdcNumber,
        phone: d.phone,
        accountStatus: 'ACTIVE'
      });

      createdDoctors.push(doctor);
    }

    // 3. Volunteers (12 volunteers)
    const volunteerPasswordHash = await hashPassword('Volunteer@123');
    const volunteersData = [
      { name: 'রহিম চৌধুরী', email: 'volunteer1@wcc.org.bd', phone: '01811000001', resp: 'Registration Desk', login: true },
      { name: 'সাদিয়া আক্তার', email: 'volunteer2@wcc.org.bd', phone: '01811000002', resp: 'Registration Desk', login: true },
      { name: 'তাহমিনা ইসলাম', email: 'volunteer3@wcc.org.bd', phone: '01811000003', resp: 'Registration Desk', login: true },
      { name: 'কাউসার আহমেদ', email: 'volunteer4@wcc.org.bd', phone: '01811000004', resp: 'Registration Desk', login: true },
      { name: 'মোঃ আরিফুল হক', email: 'volunteer5@wcc.org.bd', phone: '01811000005', resp: 'Doctor Assistant', login: false },
      { name: 'ফাতেমা বেগম', email: 'volunteer6@wcc.org.bd', phone: '01811000006', resp: 'Doctor Assistant', login: false },
      { name: 'রাকিবুল হাসান', email: 'volunteer7@wcc.org.bd', phone: '01811000007', resp: 'Pharmacy', login: false },
      { name: 'মেহজাবিন আক্তার', email: 'volunteer8@wcc.org.bd', phone: '01811000008', resp: 'Pharmacy', login: false },
      { name: 'তানজিল হোসেন', email: 'coordinator1@wcc.org.bd', phone: '01811000009', resp: 'Coordination', login: true },
      { name: 'নাজমুল করিম', email: 'volunteer10@wcc.org.bd', phone: '01811000010', resp: 'Coordination', login: false },
      { name: 'রুমানা ইয়াসমিন', email: 'volunteer11@wcc.org.bd', phone: '01811000011', resp: 'General Support', login: false },
      { name: 'জুবায়ের আহমেদ', email: 'volunteer12@wcc.org.bd', phone: '01811000012', resp: 'General Support', login: false }
    ];

    const createdVolunteers = [];
    for (const v of volunteersData) {
      let userId = null;
      if (v.login) {
        const u = await User.create({
          name: v.name,
          email: v.email,
          passwordHash: volunteerPasswordHash,
          role: v.resp === 'Coordination' ? 'CAMP_COORDINATOR' : 'REGISTRATION_VOLUNTEER',
          accountStatus: 'ACTIVE'
        });
        userId = u._id;
      }

      const vol = await Volunteer.create({
        userId,
        fullName: v.name,
        email: v.email,
        phone: v.phone,
        responsibility: v.resp,
        accountStatus: 'ACTIVE'
      });

      createdVolunteers.push(vol);
    }

    // 4. Initial Demo Health Camp (Active)
    const campDate = new Date();
    const camp = await Camp.create({
      campCode: 'CAMP-2026-001',
      name: 'কুড়িগ্রাম প্রত্যন্ত শিশু স্বাস্থ্য ক্যাম্প ২০২৬',
      date: campDate,
      district: 'কুড়িগ্রাম',
      upazila: 'চিলমারী',
      venue: 'চিলমারী সরকারি উচ্চ বিদ্যালয় প্রাঙ্গণ',
      description: 'চিলমারী চরাঞ্চলের সুবিধাবঞ্চিত শিশুদের জন্য বিনামূল্যে সাধারণ চিকিৎসা, স্বাস্থ্য পরীক্ষা ও পুষ্টি পরামর্শ ক্যাম্প।',
      organizerName: 'We Can Change (WCC)',
      status: 'ACTIVE',
      activatedAt: new Date(),
      createdBy: superAdmin._id
    });

    // 5. Assign all 4 doctors and 12 volunteers to the camp
    for (const doc of createdDoctors) {
      await CampMember.create({
        campId: camp._id,
        doctorId: doc._id,
        userId: doc.userId,
        campRole: 'DOCTOR'
      });
    }

    for (const vol of createdVolunteers) {
      await CampMember.create({
        campId: camp._id,
        volunteerId: vol._id,
        userId: vol.userId || null,
        campRole: vol.responsibility === 'Coordination' ? 'COORDINATOR' : 'VOLUNTEER'
      });
    }

    logger.info('================================================================');
    logger.info('Seeding completed successfully!');
    logger.info('Default Super Admin: admin@wcc.org.bd / AdminPassword@123');
    logger.info('Default Doctor: dr.farhana@wcc.org.bd / Doctor@123');
    logger.info('Default Volunteer: volunteer1@wcc.org.bd / Volunteer@123');
    logger.info('Default Coordinator: coordinator1@wcc.org.bd / Volunteer@123');
    logger.info('Active Camp Code: CAMP-2026-001');
    logger.info('================================================================');
  } catch (error) {
    logger.error({ error: error.message }, 'Error seeding initial data');
  }
}

if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/database');
  connectDB().then(async () => {
    await seedInitialData();
    await disconnectDB();
    process.exit(0);
  });
}

module.exports = { seedInitialData };
